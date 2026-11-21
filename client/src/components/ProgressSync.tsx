import { useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  activateProgressAccount,
  applyMergedProgress,
  PROGRESS_CHANGE_EVENT,
  readProgressSnapshot,
} from "@/lib/progressSync";

export default function ProgressSync({ onHydrated }: { onHydrated: () => void }) {
  const { user, loading, error } = useAuth();
  const { mutateAsync } = trpc.progress.sync.useMutation();
  const mutateRef = useRef(mutateAsync);
  mutateRef.current = mutateAsync;
  const readyRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      readyRef.current = false;
      if (!error) {
        try { if (activateProgressAccount(null)) onHydrated(); }
        catch (error) { console.warn("Guest progress could not be activated.", error); }
      }
      return;
    }

    let active = true;
    let initial = true;
    let inFlight = false;
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    readyRef.current = false;
    let switchedAccount = false;
    try {
      switchedAccount = activateProgressAccount(user.id);
    } catch (error) {
      console.warn("Progress sync is paused because local account storage could not be isolated.", error);
      return;
    }

    const sync = async () => {
      if (!active || inFlight) { pending = true; return; }
      inFlight = true;
      pending = false;
      try {
        const merged = await mutateRef.current({ items: readProgressSnapshot() });
        if (!active) return;
        const changed = applyMergedProgress(merged);
        if (initial && (switchedAccount || changed)) onHydrated();
      } catch (error) {
        // The local copy remains authoritative until a successful retry.
        console.debug("Progress sync deferred; local progress is preserved.", error);
      } finally {
        inFlight = false;
        if (active) {
          readyRef.current = true;
          initial = false;
          if (pending) schedule();
        }
      }
    };

    const schedule = () => {
      if (!active) return;
      if (inFlight || !readyRef.current) { pending = true; return; }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void sync(); }, 800);
    };
    const onChange = () => schedule();
    window.addEventListener(PROGRESS_CHANGE_EVENT, onChange);
    window.addEventListener("online", onChange);
    window.addEventListener("focus", onChange);
    void sync();

    return () => {
      active = false;
      readyRef.current = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener(PROGRESS_CHANGE_EVENT, onChange);
      window.removeEventListener("online", onChange);
      window.removeEventListener("focus", onChange);
    };
  }, [loading, user?.id, error, onHydrated]);

  return null;
}
