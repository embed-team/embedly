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
        "docs",

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
        "release"
      ]
    ]
  }
};
