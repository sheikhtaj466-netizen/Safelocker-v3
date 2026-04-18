module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin', // 🔥 YEH LINE HONA 100% ZAROORI HAI
    ],
  };
};
