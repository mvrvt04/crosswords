/**
 * Accounts every installation starts with. There is no self-registration:
 * the admin creates players, and each player gets a personal sign-in link.
 *
 * Matteo's link token is fixed so the link sent with the submission keeps
 * working even if the database is recreated on a redeploy.
 */
export interface SeedAccount {
  id: string;
  name: string;
  username: string;
  /** Plain text, hashed by the server on first boot. Null = sign in by link only. */
  password: string | null;
  loginToken: string;
}

export const SEED_ACCOUNTS: SeedAccount[] = [
  {
    id: 'matteo-natale',
    name: 'Matteo Natale',
    username: 'matteo@apollo.st',
    password: 'password',
    loginToken: 'matteo-natale-apollo',
  },
];
