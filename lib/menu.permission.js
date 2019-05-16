'use strict';

module.exports = {
    parseMenuPermission: function (menuPermission) {
        let paths = [];

        try {
            let perms = JSON.parse(menuPermission);
            perms.forEach((perm) => {
                if (perm.permission[0] === 'on') {
                    if (perm.path.length !== 0) paths.push('/' + perm.path);

                    perm.sub.forEach((subPerm) => {
                        if (subPerm.permission[0] === 'on' && subPerm.path.length !== 0) {
                            paths.push('/' + subPerm.path);
                        }
                    });
                }
            });
        } catch (e) {}

        return paths;
    }
};