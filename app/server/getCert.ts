import fs from 'fs';
import { createCA, createCert } from 'mkcert';
import { getLocalIp } from './getLocalIp';

export async function getCert(key: string) {
  const certFileLocation = `./${key}.cert.json`;
  // Check if cert file exists
  try {
    const certData = await fs.promises.readFile(certFileLocation, 'utf-8');
    return JSON.parse(certData);
  } catch {
    // Create new cert
    const ca = await createCA({
      organization: 'Algofonia Dev CA',
      countryCode: 'DE',
      state: 'Berlin',
      locality: 'Berlin',
      validity: 365,
    });

    if (!getLocalIp()) {
      throw new Error(`Problem getting local IP`);
    }

    const cert = await createCert({
      ca: { key: ca.key, cert: ca.cert },
      domains: ['127.0.0.1', 'localhost', getLocalIp()!],
      validity: 365,
    });

    const json = { ca, cert };
    // Save cert to file
    await fs.promises.writeFile(
      certFileLocation,
      JSON.stringify(json),
      'utf-8'
    );
    return json;
  }
}
