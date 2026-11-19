Rails.application.routes.draw do
  root "invoices#index"
  resources :invoices, only: :index
  resources :customers, only: :index
  post "agent" => "agents#create", as: :agent
end
