
# DATAR API Keys Management
Environment variables (.env)

    POSTGRES_DB=''
    POSTGRES_HOST='localhost'
    POSTGRES_USER='postgres'
    POSTGRES_PASSWORD=''
    SESSION_SECRET=''
## Requirements

- Linux Server (Ubuntu 18.04 recommended)
 - [IBM Watson Natural Language Understanding API Key](https://www.ibm.com/watson/services/natural-language-understanding/)
- Node.js v10 or later
- PostgreSQL 10 or later
## Setup
```bash
psql -U databaseUser -W databaseName < db.sql
```
**Note:** Remove `-W` if you do not have a password.
## Install

```bash
npm install
```

## Usage

```bash
npm start
```
# Changes
The project has been split into a few parts:
### Core

- [DATAR API Keys Management](https://github.com/va2ron1/datar-management)
- [DATAR API](https://github.com/va2ron1/datar-api)
### Demos (Not available yet)
- Web platform (rebuilt from scratch in Vue.js)
- Mobile App (iOS version) (rebuilt from scratch)
- Text Messaging (# Not available yet)
# License
See [Apache License 2.0](https://github.com/va2ron1/datar-node-api/blob/master/LICENSE)
