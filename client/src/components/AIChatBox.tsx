import { AlertCircle, ArrowLeft, ExternalLink, Loader2, RotateCw, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { RAFIQ_MESSAGE_LENGTH } from "@shared/const";

export type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; url: string; publisher: string }[];
};

type AIChatBoxProps = {
  initialQuestion?: string;
  messages: Message[];
  onSendMessage: (question: string) => void;
  onRetry: () => void;
  isLoading: boolean;
  error: string | null;
};

const prompts = ["كيف أبدأ تدبر القرآن؟", "ما الفرق بين النص والشرح؟", "كيف أتحقق من حديث منسوب؟"];

function emphasis(text: string) {
  return text.split(/\*\*([^*\r\n]+)\*\*/).map((part, index) =>
    index % 2 === 0 ? part : <strong key={index}>{part}</strong>
  );
}

function AssistantAnswer({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks = [];
  const orderedItem = /^(?:\d+|[٠-٩]+)[.)]\s+(.+)$/u;
  const bulletItem = /^[-*•]\s+(.+)$/u;

  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    const start = index++;
    if (!line || /^-{3,}$/.test(line)) continue;

    const heading = line.match(/^#{2,4}\s+(.+)$/);
    if (heading) {
      blocks.push(<h3 key={start}>{emphasis(heading[1])}</h3>);
      continue;
    }

    const itemPattern = orderedItem.test(line) ? orderedItem : bulletItem;
    const first = line.match(itemPattern);
    if (first) {
      const items: { text: string; bullets: string[] }[] = [{ text: first[1], bullets: [] }];
      for (let next = index; next < lines.length; next++) {
        const raw = lines[next];
        const text = raw.trim();
        if (!text) continue;
        const nested = itemPattern === orderedItem && /^(?: {2,}|\t)/.test(raw) ? text.match(bulletItem) : null;
        if (nested) {
          items[items.length - 1].bullets.push(nested[1]);
          index = next + 1;
          continue;
        }
        const item = text.match(itemPattern);
        if (!item) break;
        items.push({ text: item[1], bullets: [] });
        index = next + 1;
      }
      const List = itemPattern === orderedItem ? "ol" : "ul";
      blocks.push(<List key={start}>{items.map((item, offset) => <li key={offset}>
        {emphasis(item.text)}
        {item.bullets.length > 0 && <ul>{item.bullets.map((bullet, position) =>
          <li key={position}>{emphasis(bullet)}</li>
        )}</ul>}
      </li>)}</List>);
      continue;
    }

    blocks.push(<p key={start}>{emphasis(line)}</p>);
  }
  return <div className="rafiq-answer" dir="auto">{blocks}</div>;
}

export function AIChatBox({ messages, onSendMessage, onRetry, isLoading, error, initialQuestion }: AIChatBoxProps) {
  const [input, setInput] = useState(initialQuestion ?? "");
  const transcript = useRef<HTMLDivElement>(null);
  const latestTurn = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = transcript.current;
    if (!element) return;
    const turn = latestTurn.current;
    if (!isLoading && !error && messages.at(-1)?.role === "assistant" && turn && turn.offsetHeight >= element.clientHeight) {
      element.scrollTop += turn.getBoundingClientRect().top - element.getBoundingClientRect().top - 12;
    } else {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages, isLoading, error]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (isLoading || !question) return;
    onSendMessage(question);
    setInput("");
  }

  return <div className="rafiq-thread">
    <div className="rafiq-transcript" ref={transcript}>
      {messages.length === 0 ? <div className="rafiq-welcome">
        <div className="rafiq-welcome-icon"><Sparkles size={24} aria-hidden="true" /></div>
        <h2>ما سؤالك اليوم؟</h2>
        <div className="rafiq-suggestions" aria-label="أسئلة للبدء">
          {prompts.map(prompt => <button type="button" key={prompt} onClick={() => onSendMessage(prompt)}>
            {prompt}<ArrowLeft size={15} aria-hidden="true" />
          </button>)}
        </div>
      </div> : <div className="rafiq-messages" role="log" aria-label="رسائل المحادثة">
        {messages.map((message, index) => <div ref={index === messages.length - 1 ? latestTurn : undefined} key={index} className={"rafiq-turn rafiq-turn-" + message.role}>
          <span className="rafiq-speaker">{message.role === "assistant" ? "رفيق" : "أنت"}</span>
          {message.role === "assistant"
            ? <AssistantAnswer content={message.content} />
            : <p className="rafiq-question" dir="auto">{message.content}</p>}
          {message.sources && message.sources.length > 0 && <details className="rafiq-references" onToggle={event => {
            const details = event.currentTarget;
            if (details.open) details.scrollIntoView({ block: "nearest" });
          }}>
            <summary>المصادر</summary>
            <ul>{message.sources.map(source => <li key={source.url}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                <span>{source.title}<small>{source.publisher}</small></span>
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </li>)}</ul>
          </details>}
        </div>)}
      </div>}
      {isLoading && <div className="rafiq-waiting" role="status"><Loader2 size={17} aria-hidden="true" /> جارٍ إعداد الرد…</div>}
      {error && !isLoading && <div className="rafiq-error" role="alert">
        <span><AlertCircle size={17} aria-hidden="true" />{error}</span>
        <button type="button" onClick={onRetry}><RotateCw size={15} aria-hidden="true" /> إعادة المحاولة</button>
      </div>}
    </div>
    <form className="rafiq-composer" onSubmit={submit}>
      <textarea
        aria-label="سؤالك لرفيق"
        placeholder="اكتب سؤالك هنا…"
        dir="auto"
        rows={2}
        maxLength={RAFIQ_MESSAGE_LENGTH}
        value={input}
        onChange={event => setInput(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
        }}
      />
      <button type="submit" aria-label="إرسال السؤال" disabled={isLoading || !input.trim()}>
        <Send size={17} aria-hidden="true" /><span>إرسال</span>
      </button>
    </form>
  </div>;
}
