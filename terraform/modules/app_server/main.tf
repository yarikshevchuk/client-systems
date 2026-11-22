resource "google_compute_disk" "data" {
  name = "${var.name}-data"
  type = "pd-balanced"
  zone = var.zone
  size = var.data_disk_size
}

resource "google_compute_instance" "app" {
  name         = "${var.name}-app"
  machine_type = var.machine_type
  zone         = var.zone
  tags         = ["app"]

  boot_disk {
    initialize_params {
      image = var.image
      size  = var.root_disk_size
    }
  }

  attached_disk {
    source      = google_compute_disk.data.id
    device_name = "data"
  }

  network_interface {
    subnetwork = var.subnet_id
  }

  metadata_startup_script = templatefile("${path.module}/startup.sh", {
    repo_url          = var.repo_url
    db_password       = var.db_password
    app_secret        = var.app_secret
    anthropic_api_key = var.anthropic_api_key
    gemini_api_key    = var.gemini_api_key
  })
}
