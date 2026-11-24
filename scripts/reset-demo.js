const fs = require("fs");
const path = require("path");
const { seedDatabase } = require("../src/store");
seedDatabase(true);
console.log("Demo database reset. All demo accounts restored.");
