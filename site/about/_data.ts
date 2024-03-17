import { safeLoad } from "https://deno.land/x/js_yaml_port@3.14.0/js-yaml.js";

// Merge contents of CONTACTS.yaml and ./_data/authors.yml
// into a single data structure for Project Representatives and Councilors

interface CouncilContact {
    'gh-id': string;
    'term-start': number;
    role?: string;
}
interface ProjectContact {
    project?: string;
    name: string;
    url: string;
    'gh-id': string;
}
interface Author {
    login: string;
    url: string;
    avatar: string;
    description?: string;
}
interface Councilor {
    login: string;
    url: string;
    avatar: string;
    termStart: number;
    role?: string;
    description?: string;
}
interface ProjectRep {
    login: string;
    url: string;
    avatar: string;
    description?: string;
    projectName: string;
    projectUrl: string;
}

const CONTACT_DATA: Record<string, unknown> = safeLoad(Deno.readTextFileSync("./site/foundation/CONTACTS.yaml"));
const AUTHOR_DATA: Record<string, unknown> = safeLoad(Deno.readTextFileSync("./site/_data/authors.yml"));

const councilors: Councilor[] = [];
const egc: ProjectRep[] = [];

const cfcData: CouncilContact[] = CONTACT_DATA['cf-council'] as CouncilContact[];
for(const item of cfcData) {
    const author = AUTHOR_DATA[item['gh-id']] as Author;
    if (!author) {
        console.log("No author data for", item['gh-id']);
        continue;
    }
    const councilor: Councilor = {
        login: author.login,
        url: author.url,
        avatar: author.avatar,
        termStart: item['term-start'],
    }
    if (item.role) {
        councilor.role = item.role;
    }
    if (author.description) {
        councilor.description = author.description;
    }
    councilors.push(councilor);
}

const prData: ProjectContact[] = CONTACT_DATA['egc'] as ProjectContact[];
for(const item of prData) {
    const author = AUTHOR_DATA[item['gh-id']] as Author;
    if (!author) {
        console.log("No author data for", item['gh-id']);
        continue;
    }
    const rep: ProjectRep = {
        login: author.login,
        url: author.url,
        avatar: author.avatar,
        projectName: item.project ? item.project : item.name,
        projectUrl: item.url,
    }
    if (author.description) {
        rep.description = author.description;
    }
    egc.push(rep);
}

export {
    councilors,
    egc
}