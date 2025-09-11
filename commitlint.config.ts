export default {
  extends: ["gitmoji"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        // Apps
        "api",
        "bot",

        // Packages
        "builder",
        "config",
        "logging",
        "parser",
        "platforms",
        "types",

        // Monorepo
        "workspace",
        "deps",
        "ci",
        "docs",
        "release"
      ]
    ]
  }
};
