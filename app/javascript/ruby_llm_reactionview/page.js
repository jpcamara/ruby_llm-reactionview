// Reads and sets a ReActionView page's Herb states, for the page agent and the
// Y.Map binding. A template rendered more than once, or inside a keyed row, is
// "repeated": each rendering is addressed by its row key.

const runtime = () => window.HerbRuntime

export function ready() {
  return new Promise((resolve) => {
    const check = () => (runtime()?.state ? resolve(runtime()) : setTimeout(check, 20))
    check()
  })
}

// Regions whose template declares states.
export function stateRegions() {
  const { slots, state } = runtime()
  return slots.regions().filter((region) => state.manifestFor(region)?.declarations?.length)
}

export function declarationsOf(region) {
  return runtime().state.manifestFor(region)?.declarations ?? []
}

// The page's stateful templates: [{ file, version, repeated, regions }].
export function templates() {
  const byFile = new Map()
  for (const region of stateRegions()) {
    const entry = byFile.get(region.file) ?? { file: region.file, version: region.version, regions: [] }
    entry.regions.push(region)
    byFile.set(region.file, entry)
  }
  return [...byFile.values()].map((entry) => ({ ...entry, repeated: entry.regions.length > 1 || entry.regions[0].item !== null }))
}

export const instanceKey = (region) => region.item?.key ?? String(region.occurrence)

// The scope for one state: { region, item }, or null when it isn't on the page.
export function scopeOf({ file, name, row }) {
  const { slots } = runtime()
  const template = templates().find((t) => (file ? t.file === file : declarationsOf(t.regions[0]).some((d) => d.name === name)))
  if (!template) return null

  if (template.repeated) {
    const region = template.regions.find((r) => instanceKey(r) === String(row))
    return region ? { region, item: null } : null
  }
  const region = template.regions[0]
  if (row === null || row === undefined) return { region, item: null }

  const declaration = declarationsOf(region).find((d) => d.name === name && d.scope !== "region")
  const item = declaration && slots.itemsFor(region.file, declaration.scope, region.occurrence).get(String(row))
  return item ? { region, item } : null
}

// The file, name and row of a herb:state-change event.
export function changeOf(detail) {
  const template = templates().find((t) => t.file === detail.file)
  if (template?.repeated) {
    const region = template.regions.find((r) => r.occurrence === detail.occurrence)
    return { file: detail.file, name: detail.name, row: region ? instanceKey(region) : String(detail.occurrence) }
  }
  return { file: detail.file, name: detail.name, row: detail.key ?? null }
}

export function setValue(change, value) {
  const scope = scopeOf(change)
  if (!scope) return false
  runtime().state.setState({ [change.name]: value }, { scope })
  syncSelects(change.name, value)
  return true
}

export function getValue(change) {
  const scope = scopeOf(change)
  return scope ? runtime().state.getState(change.name, { scope }) : undefined
}

// A select that sets a state with $value doesn't follow the state by itself.
export function syncSelects(name, value) {
  for (const select of document.querySelectorAll(`select[data-herb-set="${name}=$value"]`)) {
    if (select.value !== String(value)) select.value = value
  }
}

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
