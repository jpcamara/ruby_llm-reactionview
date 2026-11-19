# The workspace's view document, kept in memory instead of the database.
#
# Which filter is on or which row is open matters only while people are
# looking at the page, so this channel holds the document in a class-level
# map, as in yrby's "Ephemeral documents (no database)" docs. A server restart
# loses it until a browser reconnects and syncs its copy back. It is shared
# only within one process.
#
# Y::DocumentChannel still checks the signed grant; only storage changes.
class ViewChannel < Y::DocumentChannel
  STATES = Concurrent::Map.new

  on_load { |key| STATES[key] }

  on_change do |key, update|
    STATES.compute(key) do |state|
      doc = Y::Doc.new
      doc.apply_update(state) if state
      doc.apply_update(update)
      doc.compacted_state_update
    end
  end
end
