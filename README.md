# Volunteer Connect

Volunteer Connect is a web-based platform designed to connect volunteers with NGOs, organizations, and community service opportunities across Nepal.

The main goal of the platform is to make it easier for people to find volunteer opportunities that match their interests, skills, location, and availability. At the same time, organizations can use the platform to post opportunities, manage applications, and find suitable volunteers.

## Overview

Finding suitable volunteer opportunities can sometimes be difficult because information is spread across different organizations and platforms. Volunteer Connect provides a single platform where volunteers can discover opportunities and organizations can manage their volunteer requirements.

The system has three main types of users:

* **Volunteers** – Browse and apply for opportunities.
* **Organizations** – Create opportunities and manage volunteer applications.
* **Administrators** – Manage users, organizations, opportunities, and the overall platform.

## Features

### For Volunteers

Volunteers can:

* Browse available volunteer opportunities.
* Search opportunities by category and location.
* View details about an opportunity before applying.
* Apply to opportunities.
* Track their application status.
* Manage their profile.
* Add their skills and personal information.
* Upload a profile picture.
* View completed volunteer opportunities and ratings.

Application statuses include:

* Pending
* Approved
* Rejected

### For Organizations

Organizations can:

* Register on the platform.
* Manage their organization profile.
* Create volunteer opportunities.
* Update or delete their opportunities.
* Add details such as category, location, date, time, and available volunteer spots.
* Add a Google Maps location.
* View volunteer applications.
* Approve or reject applications.
* Monitor the number of available and filled volunteer positions.

Organization accounts need to be approved by an administrator before they can fully use the platform.

### For Administrators

Administrators have access to the main management features of the platform.

They can:

* Review organization registration requests.
* Approve or reject organizations.
* Manage volunteer and organization accounts.
* Monitor volunteer opportunities.
* View contact messages submitted by users.
* View platform activity and statistics.
* Manage users and their account status.

## Technology Stack

The project is built using the following technologies:

* **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
* **Backend:** PHP 7.4+
* **Database:** MySQL 5.7+
* **Web Server:** Apache
* **Development Environment:** XAMPP
* **Authentication:** PHP Sessions and JWT-based API authentication

The project does not depend on a frontend framework such as React or Angular. The frontend is developed using standard HTML, CSS, and JavaScript to keep the project simple and easy to understand.

## Project Structure

volunteer-connect/
│
├── index.html
│
├── css/
│   └── style.css
│
├── js/
│   ├── script.js
│   └── auth.js
│
├── pages/
│   ├── login.html
│   ├── register.html
│   ├── admin-dashboard.html
│   ├── ngo-dashboard.html
│   ├── volunteer-dashboard.html
│   ├── opportunities.html
│   └── reset-password.html
│
├── backend/
│   ├── config/
│   │   └── database.php
│   │
│   ├── api/
│   │   └── api.php
│   │
│   ├── auth/
│   │   ├── login.php
│   │   ├── register.php
│   │   ├── logout.php
│   │   ├── middleware.php
│   │   ├── forgot-password.php
│   │   └── reset-password.php
│   │
│   ├── admin/
│   │   └── dashboard.php
│   │
│   ├── ngo/
│   │   ├── create-opportunity.php
│   │   ├── update-opportunity.php
│   │   └── delete-opportunity.php
│   │
│   └── volunteer/
│       ├── applications.php
│       └── apply.php
│
├── database/
│   ├── volunteerconnect.sql
│   ├── database_schema.sql
│   └── complete_schema.sql
│
├── images/
│
└── uploads/
    ├── opportunities/
    └── profile/


## Database

Volunteer Connect uses MySQL to store user information, opportunities, applications, and other system data.

The main tables include:

### `volunteers`

Stores volunteer account and profile information such as name, email, skills, bio, and profile picture.

### `organizations`

Stores registered organizations and their approval status.

### `admins`

Stores administrator account information.

### `opportunities`

Contains volunteer opportunities created by organizations.

### `applications`

Stores applications submitted by volunteers and their current status.

### `categories`

Stores the different categories of volunteer opportunities.

### `contact_messages`

Stores messages submitted through the platform's contact form.

### `login_attempts`

Keeps records of login attempts for security and monitoring purposes.

### `activity_logs`

Stores important actions performed within the system for auditing purposes.

## Installation

### Requirements

Before running the project, make sure the following are installed:

* XAMPP
* Apache
* MySQL
* PHP 7.4 or higher
* A modern web browser

### Step 1: Copy the Project

Place the project folder inside the XAMPP `htdocs` directory.

For example:

C:\xampp\htdocs\volunteer-connect\


### Step 2: Start XAMPP

Open the XAMPP Control Panel and start:

* Apache
* MySQL

Both services should be running before opening the application.

### Step 3: Create the Database

Open **phpMyAdmin** and create a database named:

volunteerconnect


Import the following SQL file:
database/complete_schema.sql


The SQL file creates the required tables and initial data for the application.

### Step 4: Check Database Configuration

Open:

backend/config/database.php


Make sure the database configuration matches your local MySQL setup:

php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'volunteerconnect');


If your MySQL username or password is different, update the values accordingly.

### Step 5: Open the Application

After Apache and MySQL are running, open:


http://localhost/volunteer-connect/


The Volunteer Connect application should now be accessible.

## Default Administrator Account

For testing and development, the system includes a default administrator account.

Email: admin@volunteerconnect.org
Password: admin123

Important: This default password should be changed before using the application in a real production environment.


## API

The project uses a central API endpoint:

```text
backend/api/api.php
```

Different operations are handled using the `action` parameter.

### Authentication

| Method | Action     | Description               |
| ------ | ---------- | ------------------------- |
| POST   | `login`    | Log in a user             |
| POST   | `register` | Register a new user       |
| GET    | `session`  | Check the current session |
| POST   | `logout`   | Log out the current user  |

### Opportunities

| Method | Action                 | Description                           |
| ------ | ---------------------- | ------------------------------------- |
| GET    | `get_opportunities`    | Get available opportunities           |
| GET    | `get_opportunity&id=X` | Get details of a specific opportunity |
| POST   | `create_opportunity`   | Create a new opportunity              |
| POST   | `update_opportunity`   | Update an opportunity                 |
| POST   | `delete_opportunity`   | Delete an opportunity                 |

Opportunity creation, editing, and deletion are restricted to authorized organizations.

### Applications

| Method | Action                      | Description                      |
| ------ | --------------------------- | -------------------------------- |
| GET    | `get_applications`          | Get applications                 |
| POST   | `apply`                     | Apply for an opportunity         |
| POST   | `update_application_status` | Approve or reject an application |

### Administrator

| Method | Action                      | Description                             |
| ------ | --------------------------- | --------------------------------------- |
| GET    | `get_pending_organizations` | View organizations waiting for approval |
| POST   | `approve_organization`      | Approve an organization                 |
| POST   | `reject_organization`       | Reject an organization                  |
| GET    | `get_all_users`             | View registered users                   |

## Volunteer Opportunity Categories

The platform currently supports the following categories:

* Environment
* Education
* Healthcare
* Community
* Technology
* Animals

These categories can be used when creating and searching for volunteer opportunities.

## Locations

Volunteer Connect is designed for opportunities throughout Nepal.

The system supports locations based on Nepal's **77 districts**, along with a **Remote** option for opportunities that can be completed online.

## User Roles

The system has three main roles.

### 1. Volunteer

Volunteers can:

* Create and manage their profile.
* Browse opportunities.
* Apply for opportunities.
* Track their applications.
* View their completed opportunities.

### 2. Organization

Organizations can:

* Create and manage opportunities.
* View volunteer applications.
* Approve or reject applications.
* Track available volunteer positions.

Organizations must first be approved by an administrator.

### 3. Administrator

Administrators have access to the overall platform and can:

* Manage users.
* Review organizations.
* Manage organization approval requests.
* Monitor opportunities.
* View contact messages.
* View platform statistics.

## Account Status

The system uses different account statuses to control user access.

| Status      | Description                                |
| ----------- | ------------------------------------------ |
| `pending`   | Account is waiting for approval            |
| `active`    | Account is active and can use the platform |
| `inactive`  | Account has been disabled                  |
| `suspended` | Account has been temporarily suspended     |
| `rejected`  | Organization registration was rejected     |

## Security

Several basic security measures have been implemented in the application, including:

* Password hashing using bcrypt.
* Session-based authentication.
* JWT token support for API authentication.
* Role-based access control.
* Login attempt logging.
* Input validation and sanitization.
* Prepared SQL statements to reduce SQL injection risks.
* CORS configuration for API requests.
* Activity logging for important system actions.

## Google Maps Integration

Organizations can add a Google Maps location when creating an opportunity.

This allows volunteers to better understand where an opportunity is located and makes it easier for them to plan their travel.

## Profile and File Uploads

Users can upload profile pictures, while organizations can upload images related to their opportunities.

Uploaded files are stored in:

```text
uploads/
├── opportunities/
└── profile/
```

The application should validate uploaded files before storing them to reduce security risks.

## Current Project Status

The following features have been implemented:

* User registration and login
* User logout
* Session management
* Role-based dashboards
* Volunteer profiles
* Organization registration
* Organization approval workflow
* Opportunity creation
* Opportunity editing
* Opportunity deletion
* Opportunity browsing
* Volunteer applications
* Application approval and rejection
* Application status tracking
* Profile image upload
* Opportunity image upload
* Google Maps integration
* Contact form
* Admin management features
* Platform statistics
* Login attempt logging
* Activity logging

## Team Members

Bibesh Shahi Thakuri — Developer
Sujan Timalsina** — Developer

## Project Purpose

Volunteer Connect was developed as an educational and community-focused project.

The project demonstrates how a complete web application can connect different types of users, manage data through a relational database, provide role-based access, and handle common backend operations such as authentication, CRUD operations, file uploads, and application management.

The long-term idea behind the project is to make it easier for people in Nepal to find opportunities where they can contribute their time and skills to their communities.


This project is developed for educational and community service purposes.

