class CreateInvoices < ActiveRecord::Migration[8.1]
  def change
    create_table :invoices do |t|
      t.string :number
      t.string :customer
      t.integer :amount_cents
      t.string :status
      t.date :due_on
      t.date :issued_on
      t.text :notes

      t.timestamps
    end
  end
end
