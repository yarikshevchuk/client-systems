module "network" {
  source       = "./modules/network"
  name         = var.name
  region       = var.region
  public_cidr  = var.public_cidr
  private_cidr = var.private_cidr
}

module "firewall" {
  source       = "./modules/firewall"
  name         = var.name
  vpc_name     = module.network.vpc_name
  public_cidr  = var.public_cidr
  private_cidr = var.private_cidr
}

module "app_server" {
  source            = "./modules/app_server"
  name              = var.name
  zone              = var.zone
  machine_type      = var.machine_type
  image             = var.image
  root_disk_size    = var.root_disk_size
  data_disk_size    = var.data_disk_size
  subnet_id         = module.network.private_subnet_id
  repo_url          = var.repo_url
  db_password       = var.db_password
  app_secret        = var.app_secret
  anthropic_api_key = var.anthropic_api_key
  gemini_api_key    = var.gemini_api_key
}

module "load_balancer" {
  source         = "./modules/load_balancer"
  name           = var.name
  zone           = var.zone
  machine_type   = var.lb_machine_type
  image          = var.image
  root_disk_size = var.root_disk_size
  subnet_id      = module.network.public_subnet_id
  app_ip         = module.app_server.private_ip
}
