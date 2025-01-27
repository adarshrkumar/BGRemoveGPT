import fs from 'fs';

var file = fs.readFileSync(`./upload.html`, 'utf8');

export function useUploadHTML(fName) {
    if (!fName) fName = 'upload'
    return file.replace('/uploadFile', `/${fName}File`);
}

export default useUploadHTML;