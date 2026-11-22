try {
  if (localStorage.getItem("theme") !== "light") {
    document.documentElement.classList.add("dark");
  }
  if (localStorage.getItem("meethaq-reduced-effects") === "true") {
    document.documentElement.dataset.effects = "reduced";
  }
} catch {
  document.documentElement.classList.add("dark");
}
