#!/bin/bash
REPOSITORY=$1
IMAGE=$2
TAG=$3

function remove () {
  REPOSITORY_LOCAL=$1
  IMAGE_LOCAL=$2
  TAG_LOCAL=$3
  
  echo "repository:$REPOSITORY_LOCAL image:$IMAGE_LOCAL tag:$TAG_LOCAL"
  DIGEST=$(curl -v -s -H "Accept: application/vnd.docker.distribution.manifest.v2+json" http://$REPOSITORY_LOCAL/v2/$IMAGE_LOCAL/manifests/$TAG_LOCAL 2>&1 | grep Docker-Content-Digest | awk '{print ($3)}')
  if [ -n "$DIGEST" ]; then
    DIGEST=${DIGEST:0:-1}
  else
    echo "No such image in repository: $REPOSITORY_LOCAL"
    exit 2
  fi
  echo "digest: $DIGEST"
  # RESULT=$(curl -v -s -H "Accept: application/vnd.docker.distribution.manifest.v2+json" -X DELETE http://$REPOSITORY_LOCAL/v2/$IMAGE_LOCAL/manifests/$DIGEST)
  RESULT=$(curl -I -X DELETE http://$REPOSITORY_LOCAL/v2/$IMAGE_LOCAL/manifests/$DIGEST)
  echo $RESULT
}

#./removeImage.sh 192.168.3.124:5000 ubuntu 16.04
remove $REPOSITORY $IMAGE $TAG

#remove image matedata from repository
#docker exec -it registry  /bin/registry garbage-collect  /etc/docker/registry/config.yml

exit 1
