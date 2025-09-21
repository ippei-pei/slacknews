import { Firestore } from '@google-cloud/firestore';
import { AppConfig } from '../config/env.js';
import { logger } from '../logger.js';

let firestore: Firestore | null = null;

export const getFirestore = (config: AppConfig): Firestore => {
  if (firestore) {
    return firestore;
  }

  const options: ConstructorParameters<typeof Firestore>[0] = {};

  if (config.firestoreEmulatorHost) {
    logger.info({ host: config.firestoreEmulatorHost }, 'Using Firestore emulator');
    const [host, port] = config.firestoreEmulatorHost.split(':');
    options.projectId = config.googleProjectId || 'slacknews-dev';
    options.host = host;
    options.port = Number(port);
    options.ssl = false;
  }

  if (config.googleProjectId) {
    options.projectId = config.googleProjectId;
  }

  firestore = new Firestore(options);
  return firestore;
};

