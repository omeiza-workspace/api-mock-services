#!/bin/sh
# Download Twilio Voice API v2010 OpenAPI spec for Prism mock
curl -sL "https://raw.githubusercontent.com/twilio/openapi/main/spec/yaml/twilio_api_v2010.yaml" -o /spec/twilio_api_v2010.yaml
echo "Downloaded Twilio spec"
