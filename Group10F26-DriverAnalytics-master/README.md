# Welcome to your Expo app 👋

## MySQL API

The Node.js API uses `mysql2` and creates the `driver_analytics` database and tables automatically.

1. Copy `.env.example` to `.env`.
2. Set `MYSQL_ADMIN_USER` and, if required, `MYSQL_ADMIN_PASSWORD` temporarily to an account allowed to create databases and users. `MYSQL_ADMIN_PASSWORD` may remain blank for a passwordless local account.
3. Run `npm run db:setup`. This creates the `driver_app` account and writes a generated app password to `.env`.
4. The setup removes the admin password from `.env`; keep the app password only in `.env`.
5. Start the API with `npm run api`.
6. In a second terminal, run `npm run api:test`.

The API exposes:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/sessions`
- `POST /api/samples`
- `GET /api/sessions/:id`
- `GET /api/health`

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
