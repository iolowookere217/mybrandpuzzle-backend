import userModel from "../models/user.model";

export const generateUsername = async (email: string): Promise<string> => {
  const baseUsername = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");

  let username = baseUsername;
  let counter = 1;

  while (await userModel.findOne({ username })) {
    username = `${baseUsername}${counter}`;
    counter++;
  }

  return username;
};

export const generateAvatar = (): string => {
  const colors = ["FF6B6B", "4ECDC4", "45B7D1", "FFA07A", "98D8C8", "F7DC6F", "BB8FCE", "85C1E2"];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  return `https://ui-avatars.com/api/?background=${randomColor}&color=fff&bold=true&size=200&name=User`;
};
