// LOKD: parse magic comments as data, without evaluating source or nested
// backtracking regular expressions. Shared by the ESM and CJS rule entries.
const { parse } = require('espree');

function isWebpackComment(comment) {
    try {
        const source = `({${comment}})`;
        const program = parse(source, { ecmaVersion: 2022, range: true });
        const object = program.body[0]?.expression;
        if (program.body.length !== 1 || object?.type !== 'ObjectExpression' || !object.properties.length) return false;
        let end = 2;
        for (const property of object.properties) {
            if (property.type !== 'Property' || property.computed || property.method || property.shorthand || property.kind !== 'init' || property.key.type !== 'Identifier') return false;
            const prefix = source.slice(end, property.range[0]);
            if (prefix !== (end === 2 ? ' ' : ', ')) return false;
            const key = property.key.name;
            const value = property.value;
            if (source.slice(property.range[0], value.range[0]) !== `${key}: `) return false;
            const string = value.type === 'Literal' && typeof value.value === 'string';
            const boolean = value.type === 'Literal' && typeof value.value === 'boolean';
            switch (key) {
                case 'webpackChunkName':
                case 'webpackFetchPriority':
                    if (!string) return false;
                    break;
                case 'webpackPrefetch':
                case 'webpackPreload':
                    if (!boolean && !/^-?\d+$/.test(source.slice(...value.range))) return false;
                    break;
                case 'webpackIgnore':
                    if (!boolean) return false;
                    break;
                case 'webpackInclude':
                case 'webpackExclude':
                    if (value.type !== 'Literal' || !value.regex || value.regex.flags !== '') return false;
                    break;
                case 'webpackMode':
                    if (!string || !['lazy', 'lazy-once', 'eager', 'weak'].includes(value.value)) return false;
                    break;
                case 'webpackExports': {
                    const exports = value.type === 'ArrayExpression' ? value.elements : [value];
                    if (!exports.length || !exports.every(item => item?.type === 'Literal' && typeof item.value === 'string' && /^\w+$/.test(item.value))) return false;
                    break;
                }
                default:
                    return false;
            }
            end = property.range[1];
        }
        const suffix = source.slice(end, -2);
        return suffix === ' ' || suffix === ', ';
    } catch {
        return false;
    }
}

module.exports = isWebpackComment;
