# Cloudflare Workers DoH to DNS Proxy

This project implements a DNS-over-HTTPS (DoH) server using Cloudflare Workers. It listens for incoming DoH requests, and forwards them to a specified DNS server.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Steve-Tech/DoH-Worker)

## Features

This project allows you to use any TCP listening DNS server as a backend for DoH queries, adding privacy and security to plain old DNS servers.

You can specify a DNS server by sending a request to the worker with the new address in the path. For example, to set the DNS server to `8.8.8.8`, you would set your DoH URL to `https://doh.stevetech.workers.dev/8.8.8.8`. Alternatively, `https://doh.stevetech.workers.dev/dns-query` will default to using `9.9.9.9` as the DNS server. Cloudflare IPs are disallowed by workers, so `1.1.1.1` will not work.
