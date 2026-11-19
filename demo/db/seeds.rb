customers = ["Huckleberry Pie Co.", "Northwind Traders", "Blue Bottle Labs", "Fern & Finch", "Granite State Movers",
             "Lighthouse Dental", "Copper Kettle Cafe", "Tidewater Marine", "Orchard Hill School", "Pioneer Bikes"]
statuses = %w[paid paid paid open open open overdue overdue draft]
Invoice.delete_all
srand(42)
30.times do |i|
  issued = Date.new(2026, 8, 1) + rand(100)
  Invoice.create!(number: format("INV-%04d", 1041 + i), customer: customers.sample,
                  amount_cents: rand(120..9_800) * 100 + [0, 50, 99].sample,
                  status: statuses.sample, issued_on: issued, due_on: issued + [15, 30, 45].sample,
                  notes: ["Net 30.", "Paid by ACH.", "Second reminder sent.", "Disputed line 3.", ""].sample)
end
Workspace.default
