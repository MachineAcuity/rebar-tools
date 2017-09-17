parted -s /dev/vdb mklabel gpt
parted -s /dev/vdb unit mib mkpart primary 0% 100%
mkfs.ext4 /dev/vdb1

mkdir /mnt/blockstorage
echo >> /etc/fstab
echo /dev/vdb1               /mnt/blockstorage       ext4    defaults,noatime 0 0 >> /etc/fstab
mount /mnt/blockstorage

useradd ubuntu
mkdir /home/ubuntu
chown ubuntu:ubuntu /home/ubuntu

sudo bash -c "test -e /usr/bin/python || (apt -qqy update && apt install -qy python-minimal && apt install -qy python-pip)"
sudo bash -c "pip install setuptools"
sudo bash -c "pip install cassandra-driver"
