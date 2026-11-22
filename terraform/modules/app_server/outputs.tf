output "private_ip" {
  value = google_compute_instance.app.network_interface[0].network_ip
}
