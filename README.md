# Tools for managing Rebar and Universal Relay Boilerplate applications

The rebar tools are for managing [Rebar](http://codefoundries.com/products/rebar.html) and [Universal Relay Boilerplate](http://codefoundries.com/products/UniversalRelayBoilerplate.html) applications.

## Requirements

* Works only on UNIX (Mac, Linux).
* Requires Node.js `8.9` Carbon or later.
* NGINX configuration is assumed to be located at `/usr/local/etc/nginx/servers`.
* Ansible configuration is assumed to be located at `/etc/ansible`.
* Output is optimized for terminals with dark background color.

## Installation

Run `npm install -g rebar-tools`.

Notice that because the tools use `nodegit` the installation might take a substantial amount of time.

## Usage

Run `rebar --help` to receive information about options.
