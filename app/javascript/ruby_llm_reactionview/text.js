// The text a person can see on the page, for showing an agent what's there.

// What a person sees between two marker comments.
export function textBetween(start, end, limit) {
  const range = document.createRange()
  range.setStartAfter(start)
  if (end) range.setEndBefore(end)
  else range.setEndAfter(start.parentNode.lastChild)
  return visibleText(range.commonAncestorContainer, (node) => range.intersectsNode(node), limit)
}

export function visibleText(root, include = () => true, limit = 6000) {
  const walker = document.createTreeWalker(root.nodeType === Node.TEXT_NODE ? root.parentNode : root, NodeFilter.SHOW_TEXT)
  const parts = []
  let length = 0
  while (walker.nextNode() && length < limit) {
    const node = walker.currentNode
    const parent = node.parentElement
    if (!include(node) || !parent || parent.closest("script, style, template, page-agent")) continue
    if (parent.checkVisibility && !parent.checkVisibility()) continue
    const text = node.textContent.trim()
    if (text) { parts.push(text); length += text.length + 1 }
  }
  return parts.join(" ").replace(/\s+/g, " ").slice(0, limit)
}
