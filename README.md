# Colliq

A campus collaboration platform for finding teammates, sharing project ideas, and building things together.

Colliq started as TeamForge, a Semester 3 Advanced Data Structures and Algorithms project. It provides a place for students to connect based on their skills, interests, and projects.

**Live website:** https://teamforge-campus.onrender.com
**GitHub:** https://github.com/sushantsihag17-source/teamforge-campus

## About

Finding the right people for a college project or hackathon isn't always straightforward. Students usually rely on classmates, WhatsApp groups, or people they already know.

Colliq brings that process into one place.

Students can set up profiles, explore projects, find collaborators, and apply to join teams. Project owners can review applications, invite people, and manage their members.

The platform also suggests potential teammates based on the skills and interests listed in their profiles.

## Features

* **Student profiles:** Add skills, interests, academic details, and availability.
* **Project listings:** Publish project ideas and specify the skills needed.
* **Teammate discovery:** Browse students and find potential collaborators.
* **Team recommendations:** Get suggestions based on skill compatibility.
* **Applications:** Apply to join projects and review incoming requests.
* **Invitations:** Invite students to projects and manage responses.
* **Team management:** Keep track of project members and open positions.

The application doesn't contain preloaded student profiles or projects. Records are created as people register and use the platform.

## Tech Stack

| Component       | Technology            |
| --------------- | --------------------- |
| Frontend        | HTML, CSS, JavaScript |
| Backend         | Node.js               |
| Database        | Supabase PostgreSQL   |
| Authentication  | Supabase Auth         |
| Hosting         | Render                |
| Version control | GitHub                |

The backend uses Node.js's built-in HTTP module.

The frontend is written in vanilla JavaScript without a framework. Supabase's JavaScript client is loaded in the browser for authentication.

## Project Structure

```text
public/
    Website interface
    Stylesheets
    Authentication pages
    Frontend JavaScript

src/
    Application logic
    Matching algorithms

database/
    schema.sql

docs/
    Architecture documentation

server.js
package.json
render.yaml
README.md
```

The main server is defined in `server.js`. Matching and recommendation logic is maintained separately in `src/algorithms.js`.

## Running Locally

You'll need Node.js 18 or later and a Supabase project.

### Database setup

Create a project at https://supabase.com/dashboard.

Open the Supabase SQL Editor and execute the contents of:

```text
database/schema.sql
```

This creates the tables and database functions used by the application.

No sample records are inserted.

### Environment variables

The server requires the following configuration:

```env
NODE_ENV=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Use the base Supabase project URL without `/rest/v1/`.

The current implementation expects Supabase's legacy `anon` and `service_role` keys.

Keep the service-role key private. It must only be used on the server and should never be committed to GitHub.

### Start the server

Once the environment variables are configured, run:

```bash
npm start
```

The website will be available at:

```text
http://localhost:3000
```

To run the algorithm tests:

```bash
npm test
```

## Deployment

Colliq is hosted on Render and uses Supabase for authentication and data storage.

To deploy your own instance:

1. Fork or clone the repository.
2. Create a Supabase project and execute `database/schema.sql`.
3. Connect the GitHub repository to a Render Web Service.
4. Use `npm install` as the build command and `npm start` as the start command.
5. Add the required environment variables in Render.
6. Deploy the service.

The repository also includes a `render.yaml` configuration for Render's Blueprint deployment workflow.

### Authentication Configuration

After deployment, open Supabase and navigate to:

**Authentication → URL Configuration**

Set the Site URL to your deployed website address and configure the appropriate redirect URLs.

For local development, you can allow:

```text
http://localhost:3000/**
```

Email confirmation should remain enabled for public registrations.

Supabase's default email service has sending limits, so a separate SMTP provider is recommended before inviting a larger number of users.

## How Matching Works

Colliq uses several data structures and algorithms to support teammate discovery and team formation.

The implementation is available in `src/algorithms.js`.

**Hash Maps**

Used for indexing and looking up student and project information efficiently.

**Max-Heap**

Used to rank potential teammates according to their compatibility scores.

**Graphs and BFS**

Used to represent and explore connections between students based on shared interests, skills, and collaborations.

**Bipartite Matching**

Used when assigning students to project requirements. It helps find suitable candidates for different skills or roles while avoiding duplicate assignments.

The algorithms operate behind the scenes. Students interact with recommendations and team-building features through the website.

The recommendation system is rule-based and does not use a trained machine-learning model.

## Testing

The repository includes unit tests for the matching algorithms.

Run them using:

```bash
npm test
```

The tests use synthetic inputs defined within the test suite. These are separate from the data stored in Supabase.

For application testing, create two accounts and check the complete workflow: profile creation, project publishing, applications, invitations, and membership updates.

## Current Limitations

Colliq is an independent student project and is not an official Chandigarh University platform.

The current authentication system verifies email ownership when confirmation is enabled, but it does not independently verify university enrollment.

The application is suitable for testing with a small group of students. Before a wider public launch, several areas need improvement:

* Account deletion and privacy controls
* Spam prevention and rate limiting
* Reporting and moderation tools
* More reliable email delivery
* Database backup and recovery
* Monitoring and error reporting
* Better handling of inactive accounts

Render's free hosting services may also take additional time to respond after periods of inactivity.

## Contributing

Changes and improvements can be made through the GitHub repository.

Frontend files are located in `public/`, while the server and matching logic are maintained separately.

When modifying the matching algorithms, run the existing tests before committing.

Changes to the database structure should be documented carefully to avoid breaking existing accounts or project records.

The long-term goal is to make Colliq a useful platform for students who want to collaborate on projects, hackathons, research, and other technical work.
