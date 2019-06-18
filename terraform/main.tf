provider "aws" {

    access_key = "${var.aws_access_key}"
    secret_key = "${var.aws_secret_key}"

    region = "us-east-1"
}

resource "aws_lambda_function" "image_optimizer2" {
    
    function_name = "${var.function_name}"
    handler = "imageOptimizer.handler"
    runtime = "nodejs8.10"
    filename = "mediumimage.zip"
    timeout = 300
    role = "${aws_iam_role.iam_image_optimizer2.arn}"
    source_code_hash = "${base64sha256(filebase64("mediumimage.zip"))}"
    environment {
      variables = {
        BUCKET = "mediumphotosresizer",
        SIZES = "1500x1500-500x500"
      }
    }
}

resource "aws_iam_role_policy_attachment" "terraform_lambda_iam_policy_basic_execution" {
  role = "${aws_iam_role.iam_image_optimizer2.id}"
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_s3_bucket" "s3_bucket" {
  bucket = "${var.bucket_name}"
  acl    = "private"
}


resource "aws_s3_bucket_notification" "lambda_bucket_notification" {
  bucket = "${aws_s3_bucket.s3_bucket.id}"

  lambda_function {
    lambda_function_arn = "${aws_lambda_function.image_optimizer2.arn}"
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "originals"
    filter_suffix       = ".jpg"
  }

  lambda_function {
    lambda_function_arn = "${aws_lambda_function.image_optimizer2.arn}"
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "originals"
    filter_suffix       = ".jpeg"
  }

  lambda_function {
    lambda_function_arn = "${aws_lambda_function.image_optimizer2.arn}"
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "originals"
    filter_suffix       = ".png"
  }
}


resource "aws_iam_role" "iam_image_optimizer2" {
  name = "${var.role_name}"
  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "",
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
}

resource "aws_iam_role_policy" "lambda_to_s3" {
  name = "lambda_to_s3"
  role = "${aws_iam_role.iam_image_optimizer2.id}"

  policy = <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
              "s3:PutObject",
              "s3:GetObject"
            ],
            "Resource": "arn:aws:s3:::mediumphotosresizer/*"
        }
    ]
}
EOF
  
}



resource "aws_lambda_permission" "allow_terraform_bucket" {
    statement_id = "AllowExecutionFromS3Bucket"
    action = "lambda:InvokeFunction"
    function_name = "${aws_lambda_function.image_optimizer2.arn}"
    principal = "s3.amazonaws.com"
    source_arn = "${aws_s3_bucket.s3_bucket.arn}"
}

