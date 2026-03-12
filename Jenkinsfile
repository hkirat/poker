pipeline {
agent any


stages {

    stage('Build Docker Images') {
        steps {
            sh 'docker build -t pks2906/poker-backend -f docker/backend.Dockerfile .'
            sh 'docker build -t pks2906/poker-websocket -f docker/websocket.Dockerfile .'
            sh 'docker build -t pks2906/poker-user-frontend -f docker/frontend.Dockerfile .'
            sh 'docker build -t pks2906/poker-admin-frontend -f docker/frontend.Dockerfile .'
        }
    }

    stage('Push Images to Docker Hub') {
steps {
withCredentials([usernamePassword(credentialsId: 'dockerhub', usernameVariable: 'USER', passwordVariable: 'PASS')]) {
sh 'echo $PASS | docker login -u $USER --password-stdin'
sh 'docker push pks2906/poker-backend'
sh 'docker push pks2906/poker-websocket'
sh 'docker push pks2906/poker-user-frontend'
sh 'docker push pks2906/poker-admin-frontend'
}
}
}


    stage('Deploy to Kubernetes') {
        steps {
            sh 'kubectl apply -f k8s/'
        }
    }

}


}
