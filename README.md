## Student Mental Health Support System Setup

### Prerequisites
- Node.js v18+
- PostgreSQL 15+
- npm
##################################################################################


# Student Mental Health Support System – Setup Guide (Windows + WSL)

## 1. Prerequisites
- Windows 10 or 11 (admin access)
- Internet connection
- Basic CLI knowledge

## 2. Install WSL
```powershell
wsl --install
Reboot if prompted.

3. Set Up Ubuntu in WSL
Create your UNIX username & password.

4. Install Tools in Ubuntu

sudo apt update && sudo apt upgrade -y
sudo apt install postgresql postgresql-contrib -y
sudo -u postgres createdb mental_health
sudo -u postgres psql -c "\password postgres"
5. (Optional) Enable Password Auth
Edit /etc/postgresql/*/main/pg_hba.conf, change peer→md5, then:


sudo service postgresql restart
6. Install Node.js

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh |
source ~/rc
nvm install 18
nvm use 18
7. Install VS Code & Remote‑WSL
Install VS Code (https://code.visualstudio.com/)

Install “Remote – WSL” extension

In WSL: code .

8. Clone the Project

git clone <repo-url>


cd student-mental-health-support-system
9. Install Dependencies

cd backend/api && npm install
cd ../mock-school-server
rm package.json       # if broken
npm init -y
npm install express jsonwebtoken


10. Import DB Schema

sudo -u postgres psql -d mental_health -f backend/db/schema.sql


11. Configure .env (in backend/api)
env

PORT=3000
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mental_health


12. Run the Servers

cd backend/api
node server.js

cd ../mock-school-server
node index.js
Project will run on http://localhost:3000
