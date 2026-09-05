<?php
require_once __DIR__ . '/../config/database.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { jsonResponse(['success'=>true]); }

$action = $_GET['action'] ?? '';
$data = requestData();

function findUserByEmail($conn, $email) {
    foreach (['volunteers'=>'volunteer','organizations'=>'organization','admins'=>'admin'] as $table=>$role) {
        $stmt=$conn->prepare("SELECT id,name,email,password,status FROM $table WHERE email=? LIMIT 1");
        $stmt->bind_param('s',$email); $stmt->execute(); $r=$stmt->get_result();
        if($u=$r->fetch_assoc()){ $u['role']=$role; $stmt->close(); return $u; }
        $stmt->close();
    }
    return null;
}
function emailExistsAny($conn,$email){ return findUserByEmail($conn,$email)!==null; }
function userTable($role){ return $role==='volunteer'?'volunteers':($role==='organization'?'organizations':'admins'); }

function validOpportunityLocation($location) {
    return in_array($location, [
        'Achham','Arghakhanchi','Baglung','Baitadi','Bajhang','Bajura','Banke','Bara','Bardiya','Bhaktapur',
        'Bhojpur','Chitwan','Dadeldhura','Dailekh','Dang','Darchula','Dhading','Dhankuta','Dhanusha','Dolakha',
        'Dolpa','Doti','Gorkha','Gulmi','Humla','Ilam','Jajarkot','Jhapa','Jumla','Kailali','Kalikot','Kanchanpur',
        'Kapilvastu','Kaski','Kathmandu','Kavrepalanchok','Khotang','Lalitpur','Lamjung','Mahottari','Makwanpur',
        'Manang','Morang','Mugu','Mustang','Myagdi','Nawalpur','Nuwakot','Okhaldhunga','Palpa','Panchthar',
        'Parasi','Parbat','Parsa','Pyuthan','Ramechhap','Rasuwa','Rautahat','Rolpa','Rukum East','Rukum West',
        'Rupandehi','Salyan','Sankhuwasabha','Saptari','Sarlahi','Sindhuli','Sindhupalchok','Siraha',
        'Solukhumbu','Sunsari','Surkhet','Syangja','Tanahun','Taplejung','Tehrathum','Udayapur','Remote'
    ], true);
}

function validOpportunityTime($time) {
    return in_array($time, ['Morning','Afternoon','Evening','Night'], true);
}

function saveProfileImage($image, $role, $userId) {
    if (!$image || $image['error'] !== UPLOAD_ERR_OK) return ['success'=>false,'message'=>'Please choose a valid profile picture.'];
    if ($image['size'] > 500 * 1024) return ['success'=>false,'message'=>'Profile picture must be 500 KB or smaller.'];
    $imageInfo=@getimagesize($image['tmp_name']);
    $mime=$imageInfo['mime']??'';
    $allowed=['image/jpeg'=>'jpg','image/png'=>'png','image/gif'=>'gif','image/webp'=>'webp'];
    if (!$imageInfo || !isset($allowed[$mime])) return ['success'=>false,'message'=>'Use a valid JPEG, PNG, GIF, or WebP image.'];
    $uploadDir=__DIR__.'/../../uploads/profile';
    if (!is_dir($uploadDir) && !mkdir($uploadDir,0755,true)) return ['success'=>false,'message'=>'Could not prepare image storage.'];
    $filename=$role.'_'.(int)$userId.'.'.$allowed[$mime];
    if (!move_uploaded_file($image['tmp_name'],$uploadDir.'/'.$filename)) return ['success'=>false,'message'=>'Could not save profile picture.'];
    return ['success'=>true,'path'=>'uploads/profile/'.$filename];
}

function saveOpportunityImage($image, $opportunityId) {
    if (!$image || $image['error'] !== UPLOAD_ERR_OK) return ['success'=>false,'message'=>'Please choose a valid opportunity image.'];
    if ($image['size'] > 500 * 1024) return ['success'=>false,'message'=>'Opportunity image must be 500 KB or smaller.'];
    $imageInfo=@getimagesize($image['tmp_name']);
    $mime=$imageInfo['mime']??'';
    $allowed=['image/jpeg'=>'jpg','image/png'=>'png','image/gif'=>'gif','image/webp'=>'webp'];
    if (!$imageInfo || !isset($allowed[$mime])) return ['success'=>false,'message'=>'Use a valid JPEG, PNG, GIF, or WebP image.'];
    $uploadDir=__DIR__.'/../../uploads/opportunities';
    if (!is_dir($uploadDir) && !mkdir($uploadDir,0755,true)) return ['success'=>false,'message'=>'Could not prepare image storage.'];
    $filename='opportunity_'.(int)$opportunityId.'.'.$allowed[$mime];
    if (!move_uploaded_file($image['tmp_name'],$uploadDir.'/'.$filename)) return ['success'=>false,'message'=>'Could not save opportunity image.'];
    return ['success'=>true,'path'=>'uploads/opportunities/'.$filename];
}

function validateOpportunityImage($image) {
    if (!$image || $image['error'] !== UPLOAD_ERR_OK) return 'Please choose a valid opportunity image.';
    if ($image['size'] > 500 * 1024) return 'Opportunity image must be 500 KB or smaller.';
    $imageInfo=@getimagesize($image['tmp_name']);
    $allowed=['image/jpeg','image/png','image/gif','image/webp'];
    if (!$imageInfo || !in_array($imageInfo['mime']??'', $allowed, true)) return 'Use a valid JPEG, PNG, GIF, or WebP image.';
    return null;
}

switch ($action) {

case 'session':
    jsonResponse(['success'=>true,'logged_in'=>!!currentUser(),'user'=>currentUser()]);

case 'login':
    $email=trim($data['email']??''); $password=$data['password']??'';
    if(!filter_var($email,FILTER_VALIDATE_EMAIL)||$password==='') jsonResponse(['success'=>false,'message'=>'Enter a valid email and password.'],400);
    $u=findUserByEmail($conn,$email);
    if(!$u || !password_verify($password,$u['password'])) jsonResponse(['success'=>false,'message'=>'Invalid email or password.'],401);
    if($u['status']!=='active') {
        $msg=$u['role']==='organization' && $u['status']==='pending'
            ? 'Your organization account is pending admin approval. Please wait for verification.'
            : 'Your account has been suspended. Please contact support.';
        jsonResponse(['success'=>false,'message'=>$msg],403);
    }
    session_regenerate_id(true);
    $_SESSION['user_id']=(int)$u['id']; $_SESSION['user_name']=$u['name']; $_SESSION['user_email']=$u['email']; $_SESSION['user_role']=$u['role'];
    $table=userTable($u['role']); $stmt=$conn->prepare("UPDATE $table SET last_login=NOW() WHERE id=?"); $stmt->bind_param('i',$u['id']); $stmt->execute(); $stmt->close();
    audit($conn,'login','Successful login');
    jsonResponse(['success'=>true,'message'=>'Login successful.','user'=>currentUser()]);

case 'register':
    $name=trim($data['name']??''); $email=trim($data['email']??''); $password=$data['password']??''; $confirm=$data['confirm_password']??''; $role=$data['role']??'volunteer';
    if($name===''||!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($password)<8||$password!==$confirm) jsonResponse(['success'=>false,'message'=>'Please provide valid registration details.'],400);
    if(!in_array($role,['volunteer','organization'],true)) jsonResponse(['success'=>false,'message'=>'Invalid role.'],400);
    if(emailExistsAny($conn,$email)) jsonResponse(['success'=>false,'message'=>'Email is already registered.'],409);
    $hash=password_hash($password,PASSWORD_BCRYPT);
    if($role==='volunteer') {
        $stmt=$conn->prepare("INSERT INTO volunteers(name,email,password,location,skills,bio,status) VALUES(?,?,?,?,?,?,'active')");
        $location=trim($data['location']??''); $skills=trim($data['skills']??''); $bio=trim($data['bio']??'');
        $stmt->bind_param('ssssss',$name,$email,$hash,$location,$skills,$bio);
        if(!$stmt->execute()) jsonResponse(['success'=>false,'message'=>'Registration failed. Please try again.'],500);
        $id=$stmt->insert_id; $stmt->close();
        $stmt=$conn->prepare("INSERT INTO volunteer_profiles(volunteer_id,name) VALUES(?,?)"); $stmt->bind_param('is',$id,$name); $stmt->execute(); $stmt->close();
        jsonResponse(['success'=>true,'message'=>'Volunteer account created! You can now log in.'],201);
    } else {
        $phone=trim($data['phone']??''); $address=trim($data['address']??''); $description=trim($data['description']??''); $category=trim($data['category']??'General');
        $stmt=$conn->prepare("INSERT INTO organizations(name,email,password,phone,address,description,category,status) VALUES(?,?,?,?,?,?,?,'pending')");
        $stmt->bind_param('sssssss',$name,$email,$hash,$phone,$address,$description,$category);
        if(!$stmt->execute()) jsonResponse(['success'=>false,'message'=>'Registration failed. Please try again.'],500);
        $id=$stmt->insert_id; $stmt->close();
        $stmt=$conn->prepare("INSERT INTO organization_profiles(organization_id,org_name) VALUES(?,?)"); $stmt->bind_param('is',$id,$name); $stmt->execute(); $stmt->close();
        jsonResponse(['success'=>true,'message'=>'Organization registration submitted! Your account is pending admin approval.'],201);
    }

case 'logout':
    if(!empty($_SESSION['user_id'])) audit($conn,'logout','User signed out');
    $_SESSION=[]; if(ini_get('session.use_cookies')){ $p=session_get_cookie_params(); setcookie(session_name(),' ',time()-42000,$p['path'],$p['domain'],$p['secure'],$p['httponly']); } session_destroy();
    jsonResponse(['success'=>true,'message'=>'Signed out successfully.']);

case 'contact_submit':
    $name=trim($data['name']??''); $email=trim($data['email']??''); $subject=trim($data['subject']??''); $message=trim($data['message']??'');
    if($name===''||!filter_var($email,FILTER_VALIDATE_EMAIL)||$subject===''||$message==='')
        jsonResponse(['success'=>false,'message'=>'Please complete all contact fields.'],400);
    if(strlen($name)>120||strlen($subject)>255||strlen($message)>10000)
        jsonResponse(['success'=>false,'message'=>'One or more fields are too long.'],400);
    $stmt=$conn->prepare("INSERT INTO contact_messages(name,email,subject,message) VALUES(?,?,?,?)");
    if(!$stmt) jsonResponse(['success'=>false,'message'=>'Could not save your message.'],500);
    $stmt->bind_param('ssss',$name,$email,$subject,$message);
    if(!$stmt->execute()){ $stmt->close(); jsonResponse(['success'=>false,'message'=>'Could not save your message.'],500); }
    $stmt->close();
    jsonResponse(['success'=>true,'message'=>'Thank you for reaching out! We will reply shortly.'],201);

case 'opportunities':
    $where="o.status='active'"; $params=[]; $types='';
    if(!empty($_GET['search'])) { $where.=" AND (o.title LIKE ? OR o.description LIKE ? OR org.name LIKE ?)"; $q='%'.$_GET['search'].'%'; $params=[$q,$q,$q]; $types='sss'; }
    if(!empty($_GET['category'])) { $where.=' AND o.category=?'; $params[]=$_GET['category']; $types.='s'; }
    if(!empty($_GET['location'])) { $where.=' AND o.location=?'; $params[]=$_GET['location']; $types.='s'; }
    if(!empty($_GET['time'])) { $where.=' AND o.time_commitment=?'; $params[]=$_GET['time']; $types.='s'; }
    $sql="SELECT o.*,org.name org_name,(SELECT COUNT(*) FROM applications a WHERE a.opportunity_id=o.id AND a.status='approved') approved_spots_filled FROM opportunities o JOIN organizations org ON org.id=o.organization_id WHERE $where ORDER BY o.urgent DESC,o.start_date ASC,o.created_at DESC";
    $stmt=$conn->prepare($sql); if($params) $stmt->bind_param($types,...$params); $stmt->execute(); $rows=$stmt->get_result()->fetch_all(MYSQLI_ASSOC); $stmt->close();
    foreach($rows as &$r){
        $r['id']=(int)$r['id'];
        $r['spots']=(int)($r['spots_needed']??$r['spots']??10);
        $r['spots_filled']=(int)($r['approved_spots_filled']??0);
        $r['filled']=$r['spots_filled'];
        $r['urgent']=(bool)$r['urgent'];
        $r['org']=$r['org_name'];
        $r['date']=$r['start_date'];
        $r['time']=$r['time_commitment'];
        $r['desc']=$r['description'];
    }
    jsonResponse(['success'=>true,'opportunities'=>$rows]);

case 'apply':
    requireRole('volunteer'); $opp=(int)($data['opportunity_id']??0); if(!$opp) jsonResponse(['success'=>false,'message'=>'Invalid opportunity.'],400);
    $stmt=$conn->prepare("SELECT id,spots_needed,status FROM opportunities WHERE id=?");$stmt->bind_param('i',$opp);$stmt->execute();$o=$stmt->get_result()->fetch_assoc();$stmt->close();
    if(!$o||$o['status']!=='active') jsonResponse(['success'=>false,'message'=>'Opportunity is not available.'],404);
    $stmt=$conn->prepare("SELECT id FROM applications WHERE volunteer_id=? AND opportunity_id=?");$stmt->bind_param('ii',$_SESSION['user_id'],$opp);$stmt->execute();$exists=$stmt->get_result()->fetch_assoc();$stmt->close();
    if($exists) jsonResponse(['success'=>false,'message'=>'You have already applied for this opportunity.'],409);
    $stmt=$conn->prepare("SELECT COUNT(*) c FROM applications WHERE opportunity_id=? AND status='approved'");$stmt->bind_param('i',$opp);$stmt->execute();$count=$stmt->get_result()->fetch_assoc()['c'];$stmt->close();
    $status=((int)$count >= (int)$o['spots_needed'])?'waitlisted':'pending';
    $stmt=$conn->prepare("INSERT INTO applications(opportunity_id,volunteer_id,status) VALUES(?,?,?)");$stmt->bind_param('iis',$opp,$_SESSION['user_id'],$status);$stmt->execute();$id=$stmt->insert_id;$stmt->close();
    audit($conn,'apply_opportunity','Application #'.$id.' submitted');
    jsonResponse(['success'=>true,'message'=>'Application submitted successfully!','status'=>$status]);

case 'my_applications':
    requireRole('volunteer');
    $stmt=$conn->prepare("SELECT a.id,a.status,a.applied_at applied,o.id opp_id,o.title,o.category,o.location,o.start_date date,o.time_commitment time,org.name org FROM applications a JOIN opportunities o ON o.id=a.opportunity_id JOIN organizations org ON org.id=o.organization_id WHERE a.volunteer_id=? ORDER BY a.applied_at DESC");
    $stmt->bind_param('i',$_SESSION['user_id']);$stmt->execute();$rows=$stmt->get_result()->fetch_all(MYSQLI_ASSOC);$stmt->close();
    jsonResponse(['success'=>true,'applications'=>$rows]);

case 'profile':
    requireLogin(); $role=$_SESSION['user_role']; $table=userTable($role);
    $stmt=$conn->prepare("SELECT * FROM $table WHERE id=?");$stmt->bind_param('i',$_SESSION['user_id']);$stmt->execute();$u=$stmt->get_result()->fetch_assoc();$stmt->close();
    unset($u['password']);
    jsonResponse(['success'=>true,'profile'=>$u]);

case 'profile_update':
    requireLogin(); $role=$_SESSION['user_role']; $name=trim($data['name']??'');$email=trim($data['email']??'');
    if($name===''||!filter_var($email,FILTER_VALIDATE_EMAIL)) jsonResponse(['success'=>false,'message'=>'Name and valid email are required.'],400);
    $profileImagePath=null;
    if (!empty($_FILES['profile_image'])) {
        $imageResult=saveProfileImage($_FILES['profile_image'],$role,$_SESSION['user_id']);
        if (!$imageResult['success']) jsonResponse($imageResult,400);
        $profileImagePath=$imageResult['path'];
    }
    $table=userTable($role);
    $stmt=$conn->prepare("SELECT id FROM $table WHERE email=? AND id<>?");$stmt->bind_param('si',$email,$_SESSION['user_id']);$stmt->execute();
    if($stmt->get_result()->num_rows){$stmt->close();jsonResponse(['success'=>false,'message'=>'Email is already in use.'],409);}
    $stmt->close();
    if($role==='volunteer'){
        $phone=$data['phone']??'';$loc=$data['location']??'';$bio=$data['bio']??'';$skills=$data['skills']??'';
        if ($profileImagePath) {
            $stmt=$conn->prepare("UPDATE volunteers SET name=?,email=?,phone=?,location=?,bio=?,skills=?,profile_image=? WHERE id=?");
            $stmt->bind_param('sssssssi',$name,$email,$phone,$loc,$bio,$skills,$profileImagePath,$_SESSION['user_id']);
        } else {
            $stmt=$conn->prepare("UPDATE volunteers SET name=?,email=?,phone=?,location=?,bio=?,skills=? WHERE id=?");
            $stmt->bind_param('ssssssi',$name,$email,$phone,$loc,$bio,$skills,$_SESSION['user_id']);
        }
    } elseif($role==='organization'){
        $phone=$data['phone']??'';$addr=$data['location']??'';$bio=$data['bio']??'';
        if ($profileImagePath) {
            $stmt=$conn->prepare("UPDATE organizations SET name=?,email=?,phone=?,address=?,description=?,profile_image=? WHERE id=?");
            $stmt->bind_param('ssssssi',$name,$email,$phone,$addr,$bio,$profileImagePath,$_SESSION['user_id']);
        } else {
            $stmt=$conn->prepare("UPDATE organizations SET name=?,email=?,phone=?,address=?,description=? WHERE id=?");
            $stmt->bind_param('sssssi',$name,$email,$phone,$addr,$bio,$_SESSION['user_id']);
        }
    } else {
        $stmt=$conn->prepare("UPDATE admins SET name=?,email=? WHERE id=?");
        $stmt->bind_param('ssi',$name,$email,$_SESSION['user_id']);
    }
    if(!$stmt->execute()) jsonResponse(['success'=>false,'message'=>'Profile update failed.'],500);
    $stmt->close();
    $_SESSION['user_name']=$name; $_SESSION['user_email']=$email;
    audit($conn,'profile_update','Profile updated');
    jsonResponse(['success'=>true,'message'=>'Profile updated successfully.','user'=>currentUser()]);

case 'org_opportunities':
    requireRole('organization');
    $stmt=$conn->prepare("SELECT o.*, (SELECT COUNT(*) FROM applications a WHERE a.opportunity_id=o.id) applicant_count, (SELECT COUNT(*) FROM applications a WHERE a.opportunity_id=o.id AND a.status='approved') approved_spots_filled FROM opportunities o WHERE o.organization_id=? ORDER BY o.created_at DESC");
    $stmt->bind_param('i',$_SESSION['user_id']);$stmt->execute();$rows=$stmt->get_result()->fetch_all(MYSQLI_ASSOC);$stmt->close();
    foreach($rows as &$r){ $r['spots']=(int)($r['spots_needed']??10); $r['spots_filled']=(int)($r['approved_spots_filled']??0); $r['filled']=$r['spots_filled']; }
    jsonResponse(['success'=>true,'opportunities'=>$rows]);

case 'create_opportunity':
    requireRole('organization');
    $title=trim($data['title']??'');$category=trim($data['category']??'');$loc=trim($data['location']??'');
    $time=trim($data['time']??'');$spots=(int)($data['spots']??0);$date=$data['date']??'';$desc=trim($data['description']??'');$urgent=!empty($data['urgent'])?1:0;
    if($title===''||$category===''||!validOpportunityLocation($loc)||!validOpportunityTime($time)||$spots<1||$date===''||$desc==='')
        jsonResponse(['success'=>false,'message'=>'Please complete all opportunity fields.'],400);
    if (!empty($_FILES['opportunity_image'])) {
        $imageError=validateOpportunityImage($_FILES['opportunity_image']);
        if ($imageError) jsonResponse(['success'=>false,'message'=>$imageError],400);
    }
    $stmt=$conn->prepare("INSERT INTO opportunities(organization_id,title,category,location,time_commitment,spots_needed,start_date,description,urgent,status) VALUES(?,?,?,?,?,?,?,?,?,'active')");
    if (!$stmt) jsonResponse(['success'=>false,'message'=>'Could not prepare opportunity. Check the database schema.'],500);
    $stmt->bind_param('issssissi',$_SESSION['user_id'],$title,$category,$loc,$time,$spots,$date,$desc,$urgent);
    if(!$stmt->execute()) jsonResponse(['success'=>false,'message'=>'Could not create opportunity.'],500);
    $id=$stmt->insert_id;$stmt->close();
    $imagePath=null;
    if (!empty($_FILES['opportunity_image'])) {
        $imageResult=saveOpportunityImage($_FILES['opportunity_image'],$id);
        if (!$imageResult['success']) jsonResponse($imageResult,400);
        $imagePath=$imageResult['path'];
        $stmt=$conn->prepare("UPDATE opportunities SET opportunity_image=? WHERE id=?");
        $stmt->bind_param('si',$imagePath,$id); $stmt->execute(); $stmt->close();
    }
    audit($conn,'create_opportunity','Opportunity #'.$id.' created');
    jsonResponse(['success'=>true,'message'=>'Opportunity published successfully.','id'=>$id],201);

case 'update_opportunity':
    requireRole('organization');$id=(int)($data['id']??0);
    $title=trim($data['title']??'');$category=trim($data['category']??'');$loc=trim($data['location']??'');
    $time=trim($data['time']??'');$spots=(int)($data['spots']??0);$date=$data['date']??'';$desc=trim($data['description']??'');$urgent=!empty($data['urgent'])?1:0;
    if($title===''||$category===''||!validOpportunityLocation($loc)||!validOpportunityTime($time)||$spots<1||$date===''||$desc==='')
        jsonResponse(['success'=>false,'message'=>'Please complete all opportunity fields.'],400);
    if (!empty($_FILES['opportunity_image'])) {
        $imageError=validateOpportunityImage($_FILES['opportunity_image']);
        if ($imageError) jsonResponse(['success'=>false,'message'=>$imageError],400);
    }
    $stmt=$conn->prepare("UPDATE opportunities SET title=?,category=?,location=?,time_commitment=?,spots_needed=?,start_date=?,description=?,urgent=? WHERE id=? AND organization_id=?");
    $stmt->bind_param('ssssissiii',$title,$category,$loc,$time,$spots,$date,$desc,$urgent,$id,$_SESSION['user_id']);
    $stmt->execute();$ok=$stmt->affected_rows>=0;$stmt->close();
    if(!$ok) jsonResponse(['success'=>false,'message'=>'Could not update opportunity.'],500);
    if (!empty($_FILES['opportunity_image'])) {
        $imageResult=saveOpportunityImage($_FILES['opportunity_image'],$id);
        if (!$imageResult['success']) jsonResponse($imageResult,400);
        $stmt=$conn->prepare("UPDATE opportunities SET opportunity_image=? WHERE id=? AND organization_id=?");
        $stmt->bind_param('sii',$imageResult['path'],$id,$_SESSION['user_id']); $stmt->execute(); $stmt->close();
    }
    audit($conn,'update_opportunity','Opportunity #'.$id.' updated');
    jsonResponse(['success'=>true,'message'=>'Opportunity updated.']);

case 'delete_opportunity':
    requireRole('organization');$id=(int)($data['id']??0);
    $stmt=$conn->prepare("UPDATE opportunities SET status='closed' WHERE id=? AND organization_id=?");
    $stmt->bind_param('ii',$id,$_SESSION['user_id']);$stmt->execute();$stmt->close();
    audit($conn,'delete_opportunity','Opportunity #'.$id.' closed');
    jsonResponse(['success'=>true,'message'=>'Opportunity closed.']);

case 'org_applications':
    requireRole('organization');
    $stmt=$conn->prepare("SELECT a.id,a.status,a.applied_at,o.title,v.id volunteer_id,v.name volunteer_name,v.email volunteer_email,v.location,v.skills FROM applications a JOIN opportunities o ON o.id=a.opportunity_id JOIN volunteers v ON v.id=a.volunteer_id WHERE o.organization_id=? ORDER BY a.applied_at DESC");
    $stmt->bind_param('i',$_SESSION['user_id']);$stmt->execute();$rows=$stmt->get_result()->fetch_all(MYSQLI_ASSOC);$stmt->close();
    jsonResponse(['success'=>true,'applications'=>$rows]);

case 'update_application':
    requireRole('organization');$id=(int)($data['application_id']??0);$status=$data['status']??'';
    if(!in_array($status,['pending','approved','rejected','waitlisted'],true)) jsonResponse(['success'=>false,'message'=>'Invalid application status.'],400);
    $stmt=$conn->prepare("SELECT a.id FROM applications a JOIN opportunities o ON o.id=a.opportunity_id WHERE a.id=? AND o.organization_id=?");
    $stmt->bind_param('ii',$id,$_SESSION['user_id']);$stmt->execute();$ok=$stmt->get_result()->num_rows>0;$stmt->close();
    if(!$ok) jsonResponse(['success'=>false,'message'=>'Application not found.'],404);
    $stmt=$conn->prepare("UPDATE applications SET status=? WHERE id=?");$stmt->bind_param('si',$status,$id);$stmt->execute();$stmt->close();
    audit($conn,'manage_application','Application #'.$id.' set to '.$status);
    jsonResponse(['success'=>true,'message'=>'Application status updated.']);

case 'admin_stats':
    requireRole('admin');
    $r=$conn->query("SELECT
        (SELECT COUNT(*) FROM volunteers) total_volunteers,
        (SELECT COUNT(*) FROM organizations WHERE status='active') total_orgs,
        (SELECT COUNT(*) FROM organizations WHERE status='pending') pending_orgs,
        (SELECT COUNT(*) FROM opportunities WHERE status='active') active_opportunities,
        (SELECT COUNT(*) FROM applications) total_applications
    ");
    if (!$r) jsonResponse(['success'=>false,'message'=>'Could not load admin statistics: '.$conn->error],500);
    jsonResponse(['success'=>true,'stats'=>$r->fetch_assoc()]);

case 'admin_users':
    requireRole('admin');
    $rows=[];
    $r=$conn->query("SELECT id,name,email,status,created_at,'volunteer' role FROM volunteers ORDER BY created_at DESC");
    $rows=array_merge($rows,$r->fetch_all(MYSQLI_ASSOC));
    $r=$conn->query("SELECT id,name,email,status,created_at,'admin' role FROM admins ORDER BY created_at DESC");
    $rows=array_merge($rows,$r->fetch_all(MYSQLI_ASSOC));
    jsonResponse(['success'=>true,'users'=>$rows]);

case 'admin_toggle_user':
    requireRole('admin');$role=$data['role']??'';$id=(int)($data['id']??0);$status=$data['status']??'';
    if(!in_array($role,['volunteer','admin'],true)||!in_array($status,['active','inactive','suspended'],true))
        jsonResponse(['success'=>false,'message'=>'Invalid user update.'],400);
    $table=userTable($role);
    $stmt=$conn->prepare("UPDATE $table SET status=? WHERE id=?");$stmt->bind_param('si',$status,$id);$stmt->execute();$stmt->close();
    audit($conn,'manage_user','User '.$role.' #'.$id.' set to '.$status);
    jsonResponse(['success'=>true,'message'=>'User status updated.']);

case 'admin_orgs':
    requireRole('admin');
    $r=$conn->query("SELECT o.id,o.name,o.email,o.phone,o.category,o.status,o.created_at,
        COUNT(DISTINCT op.id) opportunities,
        COUNT(DISTINCT CASE WHEN a.status='approved' THEN a.volunteer_id END) volunteers
        FROM organizations o
        LEFT JOIN opportunities op ON op.organization_id=o.id AND op.status='active'
        LEFT JOIN applications a ON a.opportunity_id=op.id
        GROUP BY o.id ORDER BY o.created_at DESC");
    jsonResponse(['success'=>true,'organizations'=>$r->fetch_all(MYSQLI_ASSOC)]);

case 'admin_pending_orgs':
    requireRole('admin');
    $r=$conn->query("SELECT id,name,email,phone,address,description,category,created_at FROM organizations WHERE status='pending' ORDER BY created_at ASC");
    if (!$r) jsonResponse(['success'=>false,'message'=>'Could not load organization requests: '.$conn->error],500);
    jsonResponse(['success'=>true,'organizations'=>$r->fetch_all(MYSQLI_ASSOC)]);

case 'admin_verify_org':
    requireRole('admin');$id=(int)($data['id']??0);$status=$data['status']??'';
    if(!in_array($status,['active','rejected'],true)) jsonResponse(['success'=>false,'message'=>'Invalid status.'],400);
    $stmt=$conn->prepare("UPDATE organizations SET status=? WHERE id=?");$stmt->bind_param('si',$status,$id);$stmt->execute();$stmt->close();
    audit($conn,'verify_organization','Organization #'.$id.' set to '.$status);
    $msg=$status==='active'?'Organization approved and activated.':'Organization registration rejected.';
    jsonResponse(['success'=>true,'message'=>$msg]);

case 'admin_opportunities':
    requireRole('admin');
    $r=$conn->query("SELECT o.id,o.title,o.category,o.location,o.status,o.created_at,o.spots_needed,o.urgent,org.name org_name,
        (SELECT COUNT(*) FROM applications a WHERE a.opportunity_id=o.id) applicant_count
        FROM opportunities o JOIN organizations org ON org.id=o.organization_id
        ORDER BY o.created_at DESC LIMIT 100");
    jsonResponse(['success'=>true,'opportunities'=>$r->fetch_all(MYSQLI_ASSOC)]);

case 'admin_messages':
    requireRole('admin');
    if(!empty($_GET['mark_read'])) {
        $conn->query("UPDATE contact_messages SET status='read' WHERE status='unread'");
    }
    $r=$conn->query("SELECT id,name,email,subject,message,status,created_at FROM contact_messages ORDER BY created_at DESC LIMIT 200");
    if(!$r) jsonResponse(['success'=>false,'message'=>'Could not load contact messages.'],500);
    $messages=$r->fetch_all(MYSQLI_ASSOC);
    $unread=0;
    foreach($messages as $messageRow) if($messageRow['status']==='unread') $unread++;
    jsonResponse(['success'=>true,'messages'=>$messages,'unread'=>$unread]);

case 'admin_message_status':
    requireRole('admin');
    $id=(int)($data['id']??0); $status=$data['status']??'';
    if(!$id || !in_array($status,['unread','read'],true))
        jsonResponse(['success'=>false,'message'=>'Invalid message status.'],400);
    $stmt=$conn->prepare("UPDATE contact_messages SET status=? WHERE id=?");
    if(!$stmt) jsonResponse(['success'=>false,'message'=>'Could not update message status.'],500);
    $stmt->bind_param('si',$status,$id); $stmt->execute(); $updated=$stmt->affected_rows; $stmt->close();
    if($updated<0) jsonResponse(['success'=>false,'message'=>'Could not update message status.'],500);
    jsonResponse(['success'=>true,'message'=>'Message marked as '.$status.'.']);

case 'stats':
    requireLogin();
    if($_SESSION['user_role']==='organization'){
        $stmt=$conn->prepare("SELECT
            COUNT(CASE WHEN status='active' THEN 1 END) active_listings,
            (SELECT COUNT(*) FROM applications a JOIN opportunities x ON x.id=a.opportunity_id WHERE x.organization_id=?) applicants,
            (SELECT COUNT(DISTINCT a.volunteer_id) FROM applications a JOIN opportunities x ON x.id=a.opportunity_id WHERE x.organization_id=? AND a.status='approved') active_volunteers
            FROM opportunities WHERE organization_id=?");
        $stmt->bind_param('iii',$_SESSION['user_id'],$_SESSION['user_id'],$_SESSION['user_id']);
        $stmt->execute();$s=$stmt->get_result()->fetch_assoc();$stmt->close();
        jsonResponse(['success'=>true,'stats'=>$s]);
    }
    if($_SESSION['user_role']==='volunteer'){
        $stmt=$conn->prepare("SELECT COUNT(*) total_apps, SUM(status='approved') approved, SUM(status='pending') pending FROM applications WHERE volunteer_id=?");
        $stmt->bind_param('i',$_SESSION['user_id']);$stmt->execute();$s=$stmt->get_result()->fetch_assoc();$stmt->close();
        jsonResponse(['success'=>true,'stats'=>$s]);
    }
    $r=$conn->query("SELECT
        (SELECT COUNT(*) FROM volunteers) total_volunteers,
        (SELECT COUNT(*) FROM organizations WHERE status='active') total_orgs,
        (SELECT COUNT(*) FROM organizations WHERE status='pending') pending_orgs,
        (SELECT COUNT(*) FROM opportunities WHERE status='active') active_opportunities");
    jsonResponse(['success'=>true,'stats'=>$r->fetch_assoc()]);

default:
    jsonResponse(['success'=>false,'message'=>'Unknown API action.'],404);
}
?>
