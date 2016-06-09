"use strict";
var underscore_1 = require("underscore");
var log4js = require("log4js");
var logger = log4js.getLogger("duly-noted::ReferenceCollection");
var ReferenceCollection = (function () {
    function ReferenceCollection(id) {
        this.id = id;
        this.anchors = [];
        this.subcollections = [];
    }
    ReferenceCollection.prototype.inflate = function (collection) {
        this.id = collection.id;
        this.anchors = collection.anchors;
        for (var i = 0; i < collection.subcollections.length; i++) {
            this.subcollections.push(new ReferenceCollection(collection.subcollections[i].id).inflate(collection.subcollections[i]));
        }
        return this;
    };
    ReferenceCollection.prototype.addAnchor = function (anchor) {
        var existing = underscore_1.findWhere(this.anchors, { id: anchor.id });
        if (existing) {
            logger.error("Cannot add anchor '" + anchor.id + "' from " + anchor.file + ":" + anchor.line + " to '" + this.id + "' collection because it was already defined at " + existing.file + ":" + existing.line);
        }
        this.anchors.push(anchor);
    };
    ReferenceCollection.prototype.addSubcollection = function (collection) {
        var existingAnchor = underscore_1.findWhere(this.anchors, { id: collection.id });
        if (existingAnchor) {
            logger.error("Cannot add collection '" + collection.id + "' because it was already defined as an anchor " + existingAnchor.file + ":" + existingAnchor.line);
            return;
        }
        var existingCollection = underscore_1.findWhere(this.anchors, { id: collection.id });
        if (existingCollection) {
            logger.error("Cannot add collection '" + collection.id + "' because it was already defined as a subcollection of '" + collection.id + "'");
            return;
        }
        this.subcollections.push(collection);
    };
    ReferenceCollection.prototype.addAnchorTag = function (anchorTag, fileName, lineNumber) {
        logger.debug("processing new anchorTag: " + JSON.stringify(anchorTag));
        if (anchorTag.length === 1) {
            logger.debug("Adding anchor tag:" + anchorTag[0]);
            this.addAnchor({
                id: anchorTag[0],
                line: lineNumber,
                file: fileName
            });
            return;
        }
        else {
            var collectionTag_1 = anchorTag.shift();
            var i = underscore_1.findIndex(this.subcollections, function (item) {
                return item.id === collectionTag_1;
            });
            if (i > -1) {
                logger.debug("Collection present:" + collectionTag_1);
                return this.subcollections[i].addAnchorTag(anchorTag, fileName, lineNumber);
            }
            else {
                logger.debug("Collection not present:" + collectionTag_1);
                var newSubCollection = new ReferenceCollection(collectionTag_1);
                newSubCollection.addAnchorTag(anchorTag, fileName, lineNumber);
                this.addSubcollection(newSubCollection);
                return;
            }
        }
    };
    ReferenceCollection.prototype.getAllTags = function (parentPath, toplevel) {
        parentPath = parentPath || "";
        var allTags = [];
        if (toplevel === false) {
            for (var i = 0; i < this.anchors.length; i++) {
                if (parentPath !== "" && parentPath !== null) {
                    allTags.push({
                        anchor: parentPath + "/" + this.id + "/" + this.anchors[i].id,
                        path: this.anchors[i].file,
                        linkStub: this.anchors[i].id
                    });
                }
                else {
                    allTags.push({
                        anchor: this.id + "/" + this.anchors[i].id,
                        path: this.anchors[i].file,
                        linkStub: this.anchors[i].id
                    });
                }
            }
            for (var i = 0; i < this.subcollections.length; i++) {
                allTags = allTags.concat(this.subcollections[i].getAllTags(parentPath + "/" + this.id, false));
            }
        }
        else {
            for (var i = 0; i < this.anchors.length; i++) {
                allTags.push({
                    anchor: this.anchors[i].id,
                    path: this.anchors[i].file,
                    linkStub: this.anchors[i].id
                });
            }
            for (var i = 0; i < this.subcollections.length; i++) {
                allTags = allTags.concat(this.subcollections[i].getAllTags(null, false));
            }
        }
        return allTags;
    };
    return ReferenceCollection;
}());
exports.ReferenceCollection = ReferenceCollection;
