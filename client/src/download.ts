import { Platform, Share } from 'react-native';

// Hands the learner a copy: a file on the web, the share sheet on a phone.
export async function saveJson(name: string, data: unknown): Promise<void> {
  await saveFile(name, JSON.stringify(data, null, 2), 'json', 'application/json');
}

export async function saveText(name: string, text: string): Promise<void> {
  await saveFile(name, text, 'txt', 'text/plain');
}

async function saveFile(name: string, text: string, extension: string, type: string): Promise<void> {
  if (Platform.OS !== 'web') {
    await Share.share({ message: text, title: name });
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name.replace(/[^\w-]+/g, '-').toLowerCase()}.${extension}`;
  link.click();
  URL.revokeObjectURL(url);
}
