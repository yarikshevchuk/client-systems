output "lb_public_ip" {
  description = "Open http://<ip> in a browser"
  value       = module.load_balancer.public_ip
}

output "app_private_ip" {
  value = module.app_server.private_ip
}
