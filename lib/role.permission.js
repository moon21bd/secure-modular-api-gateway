'use strict';

const operators = {
    '=': function (expected, actual) {
        return expected == actual;
    },
    '!=': function (expected, actual) {
        return expected != actual;
    },
    'in': function (expected, actual) {
        expected = expected || [];
        actual = actual ? actual.toString() : '';

        return expected.indexOf(actual) !== -1;
    },
    'not in': function (expected, actual) {
        expected = expected || [];
        actual = actual ? actual.toString() : '';

        return expected.indexOf(actual) === -1;
    }
};

module.exports = {
    checkRolePermission: function (rolePermissions, { resource, actionType, attributes }) {
        rolePermissions = rolePermissions || {};
        let permission = rolePermissions[resource];
        if (!permission) return true;

        if (permission.actionType === 0) return false;
        if (permission.actionType && !(permission.actionType & actionType)) return false;
        if (!permission.context) return true;

        attributes = attributes || [];
        for (let i = 0; i < attributes.length; i++) {
            let attribute = attributes[i];
            let context = permission.context[attribute.name];
            if (!context) continue;

            if ( (context.actionType & actionType )
                && operators[context.operator]
                && !operators[context.operator](context.value, attribute.value)) {
                return false;
            }
        }

        return true;
    },
    actionType: {
        ALL: -1,
        DENY: 0,
        SELECT: 1,
        INSERT: 2,
        UPDATE: 4,
        DELETE: 8
    }
};