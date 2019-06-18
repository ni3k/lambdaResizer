variable "app_env" { }

variable "function_name" {
  default = "image_optimizer"
}

variable "bucket_name" {
  default = "mediumphotosresizer"
}

variable "role_name" {
  default = "iam_image_optimizer2"
}


variable "region" {
  default = "us-east-1"
}