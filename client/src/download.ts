import { Platform, Share } from 'react-native';

// Hands the learner a copy of their data: a file on the web, the share sheet on a phone.
export async function saveJson(name: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  if (Platform.OS !== 'web') {
    await Share.share({ message: json, title: name });
    return;
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name.replace(/[^\w-]+/g, '-').toLowerCase()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
