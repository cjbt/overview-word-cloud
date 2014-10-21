function API(host, vizId, apiToken) {
  this.host = host;
  this.vizId = vizId;
  this.apiTokenEncoded = new Buffer(apiToken+':x-auth-token').toString('base64');
}

API.prototype.buildRequestUrl = function(path) {
  return this.host + '/api/v1' + path;
}

API.prototype.request = function(requester, path, method, body) {
  var headers = {
    "Authorization": 'Basic ' + this.apiTokenEncoded
  };

  return requester(
    this.buildRequestUrl(path), 
    method || "GET",
    headers,
    body
  );
} 

API.prototype.getDocumentIds = function(requester, docSetId) {
  return this.request(
    requester,
    "/document-sets/" + docSetId + "/documents?fields=id"
  );
};

API.prototype.getDocument = function(requester, docId, docSetId) {
  return this.request(
    requester,
    "/document-sets/" + docSetId + "/documents/" + docId
  );
};

API.prototype.getAllDocuments = function(requester, docSetId) {
  return this.request(
    requester, 
    "/document-sets/" + docSetId + "/documents?stream=true&fields=id,text"
  );
}

API.prototype.getViz = function(requester) {
  return this.request(requester, "/vizs/" + this.vizId);
};

API.prototype.saveVizConfig = function(requester, config) {
  return this.request(
    requester,
    "/vizs/" + this.vizId,
    "PUT",
    JSON.stringify({"json": config})
  );
};

module.exports = API;