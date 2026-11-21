let timer
export function toast(text, color) {
  const box = document.getElementById("toast")
  if (!box) return
  box.textContent = text
  box.style.borderColor = color || "#999"
  box.hidden = false
  clearTimeout(timer)
  timer = setTimeout(() => { box.hidden = true }, 2500)
}
