resource "google_compute_firewall" "web_to_lb" {
  name          = "${var.name}-allow-web"
  network       = var.vpc_name
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["lb"]

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }
}

resource "google_compute_firewall" "lb_to_app" {
  name          = "${var.name}-allow-lb-to-app"
  network       = var.vpc_name
  source_ranges = [var.public_cidr]
  target_tags   = ["app"]

  allow {
    protocol = "tcp"
    ports    = ["80"]
  }
}

# SSH only through Identity-Aware Proxy
resource "google_compute_firewall" "ssh" {
  name          = "${var.name}-allow-ssh-iap"
  network       = var.vpc_name
  source_ranges = ["35.235.240.0/20"]

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
}

resource "google_compute_firewall" "icmp" {
  name          = "${var.name}-allow-icmp-internal"
  network       = var.vpc_name
  source_ranges = [var.public_cidr, var.private_cidr]

  allow {
    protocol = "icmp"
  }
}
