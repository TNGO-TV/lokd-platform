"use strict";
const fs = require("node:fs");
const path = require("node:path");
const {globSync} = require("tinyglobby");
const picomatch = require("picomatch");

// tinyglobby/fdir traverses linked directories but omits the linked directory
// itself from onlyDirectories results. Collect those entries during the same
// traversal and apply the original pattern to their lexical (not real) paths.
exports.globSync = function(pattern) {
    pattern = pattern.replace(/\/{2,}/g, (slashes, offset) => offset === 0 ? "//" : "/");
    if (!picomatch.scan(pattern).isGlob) {
        try { return fs.statSync(pattern).isDirectory() ? [path.posix.normalize(pattern)] : []; }
        catch (error) { if (error.code === "ENOENT" || error.code === "ENOTDIR" || error.code === "ELOOP") return []; throw error; }
    }
    // fast-glob requires a descendant for a terminal globstar; picomatch also
    // accepts its parent directory. Add a final segment to preserve that bound.
    pattern = pattern.replace(/\/\*\*\/?$/, "/**/*");
    const linked = [];
    const cwd = process.cwd();
    const absolute = path.isAbsolute(pattern);
    const matches = picomatch(pattern, {dot: false, posix: true});
    const directories = globSync(pattern, {
        onlyDirectories: true,
        absolute,
        expandDirectories: false,
        fs: {readdirSync(directory, options) {
            const entries = fs.readdirSync(directory, options);
            for (const entry of entries) {
                if (typeof entry === "string" || !entry.isSymbolicLink()) continue;
                const full = path.resolve(directory, entry.name);
                let stats;
                try { stats = fs.statSync(full); } catch (error) {
                    if (error.code === "ENOENT" || error.code === "ELOOP") continue;
                    throw error;
                }
                if (!stats.isDirectory()) continue;
                const lexical = (absolute ? full : path.relative(cwd, full)).replace(/\\/g, "/");
                if (matches(lexical)) linked.push(lexical);
            }
            return entries;
        }}
    });
    return [...new Set([...directories.map(value => value.replace(/\/$/, "")), ...linked])];
};
