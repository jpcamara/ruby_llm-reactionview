# Pin npm packages by running ./bin/importmap

pin "application"

# yrby. One pin per shared module, so the page loads one copy of each.
pin "yrby-client", to: "yrby/yrby-client.js"
pin "yrby-client/element", to: "yrby/yrby-client.js"
pin "yjs", to: "yrby/yjs.js"
pin "@rails/actioncable", to: "actioncable.esm.js"
pin "people"
pin "asks"
pin "toast"
pin "activity"
