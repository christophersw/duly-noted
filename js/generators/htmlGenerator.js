"use strict";
var referenceCollection_1 = require("../classes/referenceCollection");
var node_dir_1 = require("node-dir");
var fs_1 = require("fs");
var path = require("path");
var XRegExp = require("xregexp");
var handlebars = require("handlebars");
var marked = require("marked");
var fse = require("fs-extra");
var _ = require("underscore");
var log4js = require("log4js");
var logger = log4js.getLogger("duly-noted::HtmlGenerator");
var HtmlGenerator = (function () {
    function HtmlGenerator(config) {
        this.tags = [];
        this.outputDir = config.outputDir;
        this.collection = JSON.parse(fs_1.readFileSync(path.join(config.outputDir, "internalReferences.json")).toString());
        this.anchorRegExp = new RegExp(config.anchorRegExp);
        this.linkRegExp = new RegExp(config.linkRegExp);
        this.referenceCollection = new referenceCollection_1.ReferenceCollection("").inflate(JSON.parse(fs_1.readFileSync(path.join(this.outputDir, "internalReferences.json")).toString()));
        this.externalReferences = JSON.parse(fs_1.readFileSync(path.join(this.outputDir, "externalReferences.json")).toString());
        this.tags = this.referenceCollection.getAllTags();
        var projectPathArray = __dirname.split("/");
        projectPathArray.pop();
        this.projectPath = projectPathArray.join("/");
        this.template = handlebars.compile(fs_1.readFileSync(path.join(this.projectPath, "templates", "stacked.html")).toString());
        this.indexTemplate = handlebars.compile(fs_1.readFileSync(path.join(this.projectPath, "templates", "index.html")).toString());
        this.projectName = config.projectName;
        this.readme = config.readme;
        handlebars.registerHelper("md", this.markdownHelper);
        handlebars.registerHelper("ifCond", this.ifCondHelper);
    }
    HtmlGenerator.prototype.generate = function () {
        var that = this;
        node_dir_1.readFiles(this.outputDir, { match: /.json$/, exclude: /internalReferences.json|externalReferences.json/, recursive: true }, function (err, content, next) {
            that.proccessFile(err, content, next, that.outputDir);
        }, function (err, files) {
            that.cleanUp(err, files);
            that.generateIndexPage();
        });
        fse.copySync(path.join(this.projectPath, "templates", "highlight.pack.js"), path.join(this.outputDir, "scripts/highlight.js"));
        fse.copySync(path.join(this.projectPath, "templates", "css", "vs.css"), path.join(this.outputDir, "css/vs.css"));
        fse.copySync(path.join(this.projectPath, "templates", "css", "monokai-sublime.css"), path.join(this.outputDir, "css/monokai-sublime.css"));
        fse.copySync(path.join(this.projectPath, "templates", "css", "default.css"), path.join(this.outputDir, "css/default.css"));
    };
    HtmlGenerator.prototype.proccessFile = function (err, content, next, outputDir) {
        var file = JSON.parse(content);
        logger.info("Processing " + file.name);
        for (var i = 0; i < file.lines.length; i++) {
            if (typeof (file.lines[i].comment) === "string" && file.lines[i].comment !== "" && file.lines[i].comment !== null) {
                file.lines[i].comment = this.replaceAnchors(file.lines[i].comment, file.name, i);
                file.lines[i].comment = this.replaceExternalLinks(file.lines[i].comment, file.name, i);
                file.lines[i].comment = this.replaceInternalLinks(file.lines[i].comment, file.name, i);
            }
        }
        var outputMap = {
            project: this.projectName,
            items: [],
            type: file.name,
            name: file.type,
            linkPrefix: this.getLinkPrefix(file.name)
        };
        for (var i = 0; i < file.lines.length; i++) {
            if (typeof (file.lines[i].comment) === "string" && file.lines[i].comment !== "" && file.lines[i].comment !== null) {
                if (outputMap.items.length > 0 && outputMap.items[outputMap.items.length - 1].type === "comment") {
                    outputMap.items[outputMap.items.length - 1].content += "\n" + file.lines[i].comment;
                }
                else {
                    outputMap.items.push({ content: file.lines[i].comment, type: "comment", longComment: file.lines[i].longComment || false });
                }
            }
            if (typeof (file.lines[i].code) === "string" && file.lines[i].code !== "" && file.lines[i].code !== null) {
                if (outputMap.items.length > 0 && outputMap.items[outputMap.items.length - 1].type === "code") {
                    outputMap.items[outputMap.items.length - 1].content += file.lines[i].code + "\n";
                }
                else {
                    outputMap.items.push({ content: file.lines[i].code, type: "code", lang: file.type });
                }
            }
        }
        var output = this.template(outputMap);
        fs_1.writeFileSync(path.join(outputDir, file.name + ".html"), output, { flag: "w" });
        next();
    };
    HtmlGenerator.prototype.replaceAnchors = function (comment, fileName, line) {
        var pos = 0;
        var match;
        var newComment = comment;
        while (match = XRegExp.exec(newComment, this.anchorRegExp, pos, false)) {
            newComment = newComment.substr(0, match.index - 1) +
                " <a name=\"" + match[1] + "\">&#187; " + match[1] + "</a> " +
                newComment.substr(match.index + match[0].length);
            pos = match.index + match[0].length;
        }
        return newComment;
    };
    HtmlGenerator.prototype.replaceInternalLinks = function (comment, fileName, line) {
        var pos = 0;
        var match;
        var newComment = comment;
        var linkPrefix = this.getLinkPrefix(fileName);
        while (match = XRegExp.exec(newComment, this.linkRegExp, pos, false)) {
            var tag = _.findWhere(this.tags, { anchor: match[1] });
            if (!tag) {
                logger.error("link: " + match[1] + " in " + fileName + ":" + line + " does not have a cooresponding anchor, so link cannot be created.");
            }
            else {
                logger.debug("found internal link: " + match[1]);
                newComment = comment.substr(0, match.index - 1) +
                    " [" + match[1] + "](" + linkPrefix + tag.path + ".html#" + match[1] + ") " +
                    newComment.substr(match.index + match[0].length);
            }
            pos = match.index + match[0].length;
        }
        return newComment;
    };
    HtmlGenerator.prototype.replaceExternalLinks = function (comment, fileName, line) {
        var pos = 0;
        var match;
        var newComment = comment;
        while (match = XRegExp.exec(newComment, this.linkRegExp, pos, false)) {
            var tagArray = match[1].split("/");
            var tag = _.findWhere(this.externalReferences, { anchor: tagArray[0] });
            if (tag) {
                logger.debug("found external link: " + match[1]);
                for (var i = 1; i < tagArray.length; i++) {
                    tag.path = tag.path.replace("::", tagArray[i]);
                }
                newComment = comment.substr(0, match.index - 1) +
                    " [" + match[1] + "](" + tag.path + ") " +
                    newComment.substr(match.index + match[0].length);
            }
            pos = match.index + match[0].length;
        }
        return newComment;
    };
    HtmlGenerator.prototype.generateIndexPage = function () {
        var _this = this;
        logger.info("generating index.html");
        var that = this;
        var outputMap = {
            project: this.projectName,
            collections: [],
            files: [],
            readme: ""
        };
        var collections = that.referenceCollection.getTagsByCollection();
        for (var i = 0; i < collections.length; i++) {
            var anchors = _.clone(collections[i].anchors);
            for (var x = 0; x < anchors.length; x++) {
                var linkPrefix = that.getLinkPrefix(anchors[x].path);
                anchors[x].path = anchors[x].path + ".html#" + anchors[x].linkstub;
            }
            outputMap.collections.push({
                name: collections[i].name,
                anchors: anchors
            });
        }
        node_dir_1.files(this.outputDir, function (error, files) {
            for (var i = 0; i < files.length; i++) {
                var fileNameArray = files[i].split(".");
                var extension = fileNameArray[fileNameArray.length - 1];
                if (extension === "html") {
                    var pathArray = files[i].split("/");
                    pathArray.shift();
                    var path_1 = pathArray.join("/");
                    outputMap.files.push({ path: path_1 });
                }
            }
            outputMap.readme = fs_1.readFileSync(that.readme).toString();
            var output = _this.indexTemplate(outputMap);
            fs_1.writeFileSync(path.join(that.outputDir, "index.html"), output, { flag: "w" });
        });
    };
    HtmlGenerator.prototype.cleanUp = function (err, files) {
        if (err) {
            logger.error(err.message);
        }
        else {
            for (var i = 0; i < files.length; i++) {
                fs_1.unlinkSync(files[i]);
            }
        }
    };
    HtmlGenerator.prototype.getLinkPrefix = function (fileName) {
        var fileNameAsArray = fileName.split("/");
        var linkPrefix = "";
        for (var i = 0; i < fileNameAsArray.length - 2; i++) {
            linkPrefix += "../";
        }
        return linkPrefix;
    };
    HtmlGenerator.prototype.markdownHelper = function (context, options) {
        return marked(context);
    };
    HtmlGenerator.prototype.ifCondHelper = function (v1, v2, options) {
        if (v1 === v2) {
            return options.fn(this);
        }
        return options.inverse(this);
    };
    ;
    return HtmlGenerator;
}());
exports.HtmlGenerator = HtmlGenerator;
