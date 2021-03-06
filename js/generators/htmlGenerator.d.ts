import { ITag, ReferenceCollection } from "../classes/referenceCollection";
import { IConfig, IExternalReference } from "../classes/IConfig";
import Q = require("q");
export interface IHtmlGenerator {
}
export declare class HtmlGenerator implements IHtmlGenerator {
    outputDir: string;
    collection: ReferenceCollection;
    anchorRegExp: RegExp;
    linkRegExp: RegExp;
    template: any;
    indexTemplate: any;
    projectPath: string;
    referenceCollection: ReferenceCollection;
    tags: ITag[];
    externalReferences: IExternalReference[];
    readme: string;
    projectName: string;
    constructor(config: IConfig, logLevel?: string);
    generate(): Q.IPromise<{}>;
    proccessFile(err: Error, content: string, next: Function, outputDir: string): void;
    replaceAnchors(comment: string, fileName: string, line: number, position?: number): any;
    replaceLinks(comment: string, fileName: string, line: number, position?: number): any;
    generateIndexPage(): void;
    getLinkPrefix(fileName: string): string;
    markdownHelper(context: any, options: any): string;
    ifCondHelper(v1: any, v2: any, options: any): any;
}
