import base64
import json

class OverviewAPI(object):
    allowed_methods = ["get", "post", "put", "delete"]

    def __init__(self, requests, host, api_token):
        self.requests = requests
        self.host = host
        self.api_token = api_token
        self.api_token_encoded = base64.b64encode(api_token + ':x-auth-token')

    def request(self, method, path, body=""):
        assert method in OverviewAPI.allowed_methods, "Method '%s' is not allowed" % method
        requester = getattr(self.requests, method)
        headers = {'Authorization': 'Basic ' + self.api_token_encoded}

        kwargs = {"headers":headers} 
        if method not in ["get", "delete"]:
            kwargs["data"] = body

        return requester((self.host + '/api/v1' + path), **kwargs)

    def get_document_ids(self, doc_set_id):
        path = "/document-sets/" + str(doc_set_id) + "/documents?fields=id"
        return self.request("get", path).json()

    def get_document_text(self, doc_set_id, doc_id):
        path = "/document-sets/" + str(doc_set_id) + "/documents/" + str(doc_id);
        return self.request("get", path).json()

    def get_documents(self, doc_set_id):
        doc_ids = self.get_document_ids(doc_set_id)
        docs = {doc_id: self.get_document_text(doc_set_id, doc_id)["text"] 
                for doc_id in doc_ids}
        return docs

    def save_viz_data(self, viz_id, title, data):
        r = self.request("put", "/vizs/" + str(viz_id), 
                         json.dumps({"title": title, 'json': data}))
        print self.api_token_encoded
        return 200 <= r.status_code < 300
