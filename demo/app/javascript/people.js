// Avatars for everyone on the page, the agent included, from presence.
export function bindPeople(awareness) {
  const box = document.getElementById("people")
  const render = () => {
    const people = [...awareness.getStates().values()].map((s) => s.user).filter(Boolean)
    box.replaceChildren(...people.map((user) => {
      const span = document.createElement("span")
      span.className = user.agent ? "avatar is-agent" : "avatar"
      span.style.background = user.color
      span.title = user.status ? `${user.name}: ${user.status}` : user.name
      span.textContent = user.agent ? "✦" : user.name[0]
      return span
    }))
  }
  awareness.on("change", render)
  render()
  return () => awareness.off("change", render)
}
