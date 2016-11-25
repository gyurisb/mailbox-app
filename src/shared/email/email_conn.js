const BrowserBox = require('browserbox');
const SmtpClient = require('wo-smtpclient');
const MimeParser = require('emailjs-mime-parser');
const MimeBuilder = require('emailjs-mime-builder');
const utf7 = require('wo-utf7');

module.exports = EmailConnection;

function EmailConnection() {
	var conn;
	var imap;
	var sender;
	var password;
	var smtpHost;
	var smtpPort;
	var selectedFolder;
	return conn = {
		login: function(arg, success, error) {
			imap = new BrowserBox(arg.imapHost, arg.imapPort, {
				auth: {
					user: arg.username,
					pass: arg.password
				},
				id: {
					name: 'My Client',
					version: '0.1'
				}
			});
			imap.onauth = function() {
				imap.onerror = function(){};
				sender = arg.username;
				password = arg.password;
				smtpHost = arg.smtpHost;
				smtpPort = arg.smtpPort;
				success();
			};
			imap.onerror = function(err) {
				imap.onerror = function(){};
				error(err);
			}
			imap.connect();
		},
		getFolders: function(success, error) {
			imap.listMailboxes(function(err, mailboxes) {
				if (err !== undefined && err !== null) {
					error(err);
				}
				else {
					convertMailbox(mailboxes);
					success(mailboxes);
					function convertMailbox(mailbox) {
						if (mailbox.path) {
							mailbox.path = utf7.imap.decode(mailbox.path);
						}
						if (mailbox.children) {
							mailbox.children.forEach(convertMailbox);
						}
					}
				}
			});
		},
		createFolder: function(path, success, error) {
			imap.createMailbox(path, function(err, alreadyExists){
				if (!err && !alreadyExists) {
					success();
				} else {
					error(err || alreadyExists);
				}
			});
		},
		deleteFolder: function(path, success, error) {
			imap.exec({ command: 'DELETE', attributes: [utf7.imap.encode(path)] }, function(err, response, next) {
				if (err) {
					error(err);
				} else {
					success();
				}
				next();
			});
		},
		moveFolder: function(path, targetPath, success, error) {
			imap.exec({ command: 'RENAME', attributes: [utf7.imap.encode(path), utf7.imap.encode(targetPath)] }, function(err, response, next) {
				if (err) {
					error(err);
				} else {
					success();
				}
				next();
			});
		},
		getLastEmails: function(path, count, lastDate, success, error) {
			lastDate = lastDate ? new Date(lastDate.toString()) : null;
			imap.selectMailbox(utf7.imap.encode(path) || 'Inbox', function(err, mailbox){
				if (err !== undefined && err !== null) {
					error(err);
				} else {
					selectedFolder = path;
					count = Math.min(count, mailbox.exists);
					searchEmails(count, lastDate || new Date(Date.now() + 1*24*60*60*1000), function(sids, hasMore){
						var intervals = getIntervals(sids);
						getEmailsByIntervals(intervals, function(messages){
							messages.sort((a, b) => new Date(b.envelope.date).valueOf() - new Date(a.envelope.date).valueOf());
							if (lastDate) {
								messages = messages.filter(msg => new Date(msg.envelope.date) <= lastDate);
							}
							if (count >= 0) {
								messages = messages.slice(0, count);
							}
							success({ messages: messages.map(parseMessage), hasMore: hasMore && count != mailbox.exists });
						}, error);
					}, error);
				}
			});
		},
		getNewEmails: function(path, firstDate, success, error) {
			firstDate = new Date(firstDate.toString());
			imap.selectMailbox(utf7.imap.encode(path) || 'Inbox', function(err, mailbox){
				if (err !== undefined && err !== null) {
					error(err);
				} else {
					selectedFolder = path;
					if (mailbox.exists == 0) {
						success([]);
					} else {
						imap.search({ since: new Date(firstDate - 24*60*60*1000) }, {}, function(err, sids){
							if (err !== undefined && err !== null) {
								error(err);
							} else {
								var intervals = getIntervals(sids);
								getEmailsByIntervals(intervals, function(messages){
									success(messages.filter(msg => new Date(msg.envelope.date) >= firstDate).map(parseMessage));
								}, error);
							}
						});
					}
				}
			});
		},
		setEmailRead: function(path, uid, success, error) {
			selectMailbox(path, function(){
				imap.setFlags(uid + ':' + uid, { add: ['\\Seen'] }, { byUid: true }, function(err, result) {
					if (err !== undefined && err !== null) {
						error(err);
					}
					else {
						success();
					}
				});
			}, function(err){
				error(err);
			});
		},
		getEmailAttachment: function(path, uid, part, success, error) {
			selectMailbox(path, function(){
				imap.listMessages(uid + ':' + uid, ['body['+part+']'], { byUid: true }, function(err, messages) {
					if (err !== undefined && err !== null) {
						error(err);
					}
					else {
						var body = messages[0]['body['+part+']'];
						var content = body.replace('\r\n', '');
						success(content);
					}
				});
			}, function(err){
				error(err);
			});
		},
		deleteEmail: function(path, uid, success, error) {
			selectMailbox(path, function(){
				imap.deleteMessages(uid + ':' + uid, { byUid: true }, function(err) {
					if (err) {
						error(err);
					} else {
						success();
					}
				});
			}, function(err){
				error(err);
			});
		},
		moveEmail: function(path, uid, targetPath, success, error) {
			selectMailbox(path, function(){
				imap.moveMessages(uid + ':' + uid, utf7.imap.encode(targetPath), { byUid: true }, function(err) {
					if (err) {
						error(err);
					} else {
						success();
					}
				});
			}, function(err){
				error(err);
			});
		},
		sendEmail: function(message, success, error) {
			downloadAttachments(0, function(){
				var alreadySending = false;
				var client = new SmtpClient(smtpHost, smtpPort, {
					//useSecureTransport: true,
					name: sender,
					auth: {
						user: sender,
						pass: password
					}
				});
				client.onidle = function(){
					if(alreadySending){
						return;
					}
					alreadySending = true;
					client.useEnvelope({
						from: sender,
						to: message.to.concat(message.bcc)
					});
				};
				client.onready = function(failedRecipients){
					if(failedRecipients.length){
						error({ type: "rejectedAddresses", message: "The following addresses were rejected: " + failedRecipients.join(), failedRecipients: failedRecipients });
					}
					else {
						var root = new MimeBuilder("multipart/mixed");
						root.setHeader("Subject", message.subject);
						root.setHeader("To", message.to.join(", "));
						root.setHeader("Bcc", message.bcc.join(", "));
						if (message.replyTo) {
							root.setHeader("In-Reply-To", message.replyTo.messageId);
							root.setHeader("References", message.replyTo.refs + " " + message.replyTo.messageId);
						}
						var textChild = root.createChild('text/html');
						textChild.setContent(message.body);
						message.attachments.forEach(function(attachment){
							var child = root.createChild(false, { filename: attachment.name });
							child.setHeader("Content-Disposition", "attachment");
							child.setContent(new Buffer(attachment.data, "base64"));
						});
						client.send(root.build())
						client.end();
						success();
					}
				};
				client.onerror = function(err) {
					error(err);
				};
				client.connect();
			}, error);
			function downloadAttachments(i, success, error) {
				var onlineAttachments = message.attachments.filter(a => a.type == "part");
				if (i >= onlineAttachments.length){
					success();
				} else {
					var attachment = onlineAttachments[i];
					conn.getEmailAttachment(message.path, message.uid, attachment.part, function(data){
						attachment.data = data;
						downloadAttachments(i + 1, success, error);
					}, error);
				}
			}
		},
		close: function(success, error) {
			imap.close();
			success();
		},
	}

	function selectMailbox(path, success, error) {
		if (selectedFolder != path) {
			imap.selectMailbox(utf7.imap.encode(path), function(err, mailbox){
				if (err) {
					error(err);
				} else {
					selectedFolder = path;
					success();
				}
			});
		} else {
			success();
		}
	}

	function searchEmails(count, dateBefore, success, error) {
		imap.search({ on: dateBefore }, {}, function(err, ssidsOnDate){
			if (err !== undefined && err !== null) {
				error(err);
			} else {
				if (count > 0) {
					searchOldEmails(count + ssidsOnDate.length, dateBefore, addDays(dateBefore, -7), ssidsOnDate, success, error);
				} else {
					success(ssidsOnDate, true);
				}
			}
		});
		function searchOldEmails(count, dateBefore, dateSince, result, success, error) {
			imap.search({ before: dateBefore, since: dateSince }, {}, function(err, sids){
				if (err !== undefined && err !== null) {
					error(err);
				} else {
					var newResult = result.concat(sids);
					var ellapsedDays = Math.round((dateBefore - dateSince) / (24*60*60*1000));
					if (newResult.length >= count || dateSince.valueOf() <= 0) {
						if (newResult.length <= count*2 || ellapsedDays == 7) {
							success(newResult, dateSince.valueOf() > 0);
						} else {
							searchOldEmails(count, dateBefore, addDays(dateBefore, -7), result, success, error);
						}
					} else {
						searchOldEmails(count, dateSince, addDays(dateSince, -ellapsedDays*2), newResult, success, error);
					}
				}
			});
		}
	}

	function getEmailsByIntervals(uids, success, error, result) {
		result = result || [];
		if (uids.length == 0) {
			success(result);
		} else {
			imap.listMessages(uids[0], ['uid', 'flags', 'envelope', 'bodystructure', 'body.peek[header]', 'body.peek[text]'], {}, function(err, messages){
				if (err !== undefined && err !== null) {
					error(err);
				} else {
					getEmailsByIntervals(uids.slice(1), success, error, result.concat(messages));
				}
			});
		}
	}

	function getIntervals(sids) {
		if (sids.length == 0) {
			return [];
		} else {
			sids.sort((a, b) => a - b);
			var intervals = [];
			var begin = sids[0];
			for (var i = 1; i < sids.length; i++) {
				if (sids[i] != sids[i - 1] + 1) {
					intervals.push(begin + ":" + sids[i - 1]);
					begin = sids[i];
				}
			}
			intervals.push(begin + ":" + sids[sids.length - 1]);
			return intervals;
		}
	}

	function parseMessage(message) {
		message.text = message['body[text]'];
		message.contentType = message.bodystructure.type;
		if (message.contentType == 'text/html' || message.contentType == 'text/plain') {
			if (message.bodystructure.encoding == 'quoted-printable') {
				message.text = quoted_printable_decode(message.text);
			}
		} else {
			var parts = [];
			var parser = new MimeParser();
			parser.onheader = function(node) {};
			parser.onbody = function(node, chunk){
				parts.push({
					contentType: node.headers['content-type'][0].value,
					charset: node.charset,
					chunk: chunk
				});
			};
			parser.onend = function(){};
			parser.write(message['body[header]'] + message['body[text]']);
			parser.end();
			var part = parts.filter(e => e.contentType == 'text/html' && e.charset == 'utf-8')[0] || parts.filter(e => e.contentType == 'text/plain' && e.charset == 'utf-8')[0];
			if (part != null) {
				message.text = Utf8ArrayToStr(part.chunk);
				message.contentType = part.contentType;
			}
		}
		message['body[text]'] = undefined;
		return message;
	}
}

function addDays(date, days) {
	var resultDate = new Date(date.valueOf());
	resultDate.setDate(date.getDate() + days);
	return resultDate;
}

// http://www.onicos.com/staff/iz/amuse/javascript/expert/utf.txt
/* utf.js - UTF-8 <=> UTF-16 convertion
 *
 * Copyright (C) 1999 Masanao Izumo <iz@onicos.co.jp>
 * Version: 1.0
 * LastModified: Dec 25 1999
 * This library is free.  You can redistribute it and/or modify it.
 */
function Utf8ArrayToStr(array) {
    var out, i, len, c;
    var char2, char3;

    out = "";
    len = array.length;
    i = 0;
    while(i < len) {
    c = array[i++];
    switch(c >> 4)
    { 
      case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
        // 0xxxxxxx
        out += String.fromCharCode(c);
        break;
      case 12: case 13:
        // 110x xxxx   10xx xxxx
        char2 = array[i++];
        out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
        break;
      case 14:
        // 1110 xxxx  10xx xxxx  10xx xxxx
        char2 = array[i++];
        char3 = array[i++];
        out += String.fromCharCode(((c & 0x0F) << 12) |
                       ((char2 & 0x3F) << 6) |
                       ((char3 & 0x3F) << 0));
        break;
    }
    }

    return out;
}
function quoted_printable_decode (str) { 
  // eslint-disable-line camelcase
  //       discuss at: http://locutus.io/php/quoted_printable_decode/
  //      original by: Ole Vrijenhoek
  //      bugfixed by: Brett Zamir (http://brett-zamir.me)
  //      bugfixed by: Theriault (https://github.com/Theriault)
  // reimplemented by: Theriault (https://github.com/Theriault)
  //      improved by: Brett Zamir (http://brett-zamir.me)
  //        example 1: quoted_printable_decode('a=3Db=3Dc')
  //        returns 1: 'a=b=c'
  //        example 2: quoted_printable_decode('abc  =20\r\n123  =20\r\n')
  //        returns 2: 'abc   \r\n123   \r\n'
  //        example 3: quoted_printable_decode('012345678901234567890123456789012345678901234567890123456789012345678901234=\r\n56789')
  //        returns 3: '01234567890123456789012345678901234567890123456789012345678901234567890123456789'
  //        example 4: quoted_printable_decode("Lorem ipsum dolor sit amet=23, consectetur adipisicing elit")
  //        returns 4: 'Lorem ipsum dolor sit amet#, consectetur adipisicing elit'

  // Decodes all equal signs followed by two hex digits
  var RFC2045Decode1 = /=\r\n/gm

  // the RFC states against decoding lower case encodings, but following apparent PHP behavior
  var RFC2045Decode2IN = /=([0-9A-F]{2})/gim
  // RFC2045Decode2IN = /=([0-9A-F]{2})/gm,

  var RFC2045Decode2OUT = function (sMatch, sHex) {
    return String.fromCharCode(parseInt(sHex, 16))
  }

  return str.replace(RFC2045Decode1, '')
    .replace(RFC2045Decode2IN, RFC2045Decode2OUT)
}