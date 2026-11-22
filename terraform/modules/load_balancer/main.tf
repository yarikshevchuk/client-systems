resource "google_compute_instance" "lb" {
  name         = "${var.name}-lb"
  machine_type = var.machine_type
  zone         = var.zone
  tags         = ["lb"]

  boot_disk {
    initialize_params {
      image = var.image
      size  = var.root_disk_size
    }
  }

  network_interface {
    subnetwork = var.subnet_id
    access_config {}
  }

  metadata_startup_script = templatefile("${path.module}/startup.sh", {
    app_ip = var.app_ip
  })
}
